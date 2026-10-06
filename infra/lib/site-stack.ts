import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import { S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins'
import * as s3 from 'aws-cdk-lib/aws-s3'
import { BucketDeployment, CacheControl, Source } from 'aws-cdk-lib/aws-s3-deployment'
import type { Construct } from 'constructs'

// The public website: a private S3 bucket holding the built React files,
// served to the world through CloudFront.
//
//   Visitor ──HTTPS──► CloudFront (cache at edge locations worldwide)
//                          │  only CloudFront may read the bucket (OAC)
//                          ▼
//                     S3 bucket (private: Block Public Access on)
//
// CDK concepts:
//   - A "Stack" is one deployable unit. CDK turns this code into a
//     CloudFormation template, and CloudFormation creates/updates/deletes
//     the real resources to match it.
//   - A "construct" (new s3.Bucket(...), etc.) is one building block.
//     The first two arguments are always: the parent (`this`) and an ID
//     that must be unique within that parent.

export interface SiteStackProps extends StackProps {
  /** Absolute path to the built frontend (frontend/dist). */
  siteDir: string
}

export class SiteStack extends Stack {
  constructor(scope: Construct, id: string, props: SiteStackProps) {
    super(scope, id, props)

    const bucket = new s3.Bucket(this, 'SiteBucket', {
      // Nobody on the internet can read this bucket directly...
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      // ...connections must use HTTPS...
      enforceSSL: true,
      // ...and files are encrypted at rest (free, AWS-managed keys).
      encryption: s3.BucketEncryption.S3_MANAGED,
      // The site is rebuilt from code anyway, so deleting the stack may
      // delete the bucket and its files. (CDK adds a tiny helper Lambda
      // that empties the bucket first, because S3 won't delete a
      // non-empty bucket.)
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    })

    const distribution = new cloudfront.Distribution(this, 'SiteDistribution', {
      comment: 'ArmoryApply website',
      defaultRootObject: 'index.html',
      defaultBehavior: {
        // Origin Access Control: CloudFront signs its requests to S3, and the
        // bucket policy CDK generates allows ONLY this distribution to read.
        origin: S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        // AWS-managed set of standard security headers (HSTS, nosniff,
        // frame-options, referrer-policy). Free.
        responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
        compress: true,
      },
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      // Single-page app routing: there is no real file at /demo/applications,
      // so S3 answers 403 (it hides "not found" from callers who can't list
      // the bucket). We answer with index.html instead and React Router
      // shows the right page.
      errorResponses: [403, 404].map((httpStatus) => ({
        httpStatus,
        responseHttpStatus: 200,
        responsePagePath: '/index.html',
        ttl: Duration.seconds(10),
      })),
    })

    // Upload the site in two passes with different caching rules:
    //
    // 1. assets/* : Vite puts a content hash in these file names
    //    (index-DicLTLp3.js), so a changed file always gets a new name.
    //    Browsers and CloudFront may cache them for a year.
    //    prune: false keeps older versions around, so someone with an old
    //    page open can still load the files it references.
    const hashedAssets = new BucketDeployment(this, 'DeployHashedAssets', {
      sources: [Source.asset(props.siteDir)],
      destinationBucket: bucket,
      exclude: ['*'],
      include: ['assets/*'],
      prune: false,
      cacheControl: [CacheControl.fromString('public, max-age=31536000, immutable')],
    })

    // 2. Everything else (index.html, favicon, demo PDFs): same names on
    //    every deploy, so browsers must re-check them each time, and we
    //    tell CloudFront to drop its cached copies ("invalidation").
    //    One "/*" invalidation per deploy is well within the free 1,000/month.
    const rootFiles = new BucketDeployment(this, 'DeployRootFiles', {
      sources: [Source.asset(props.siteDir)],
      destinationBucket: bucket,
      exclude: ['assets/*'],
      prune: true,
      cacheControl: [CacheControl.fromString('public, max-age=0, must-revalidate')],
      distribution,
      distributionPaths: ['/*'],
    })
    // Upload the new assets before the index.html that points at them.
    rootFiles.node.addDependency(hashedAssets)

    // Printed after `cdk deploy`.
    new CfnOutput(this, 'SiteUrl', { value: `https://${distribution.distributionDomainName}` })
    new CfnOutput(this, 'DistributionId', { value: distribution.distributionId })
    new CfnOutput(this, 'BucketName', { value: bucket.bucketName })
  }
}
