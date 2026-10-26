#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { AwsCdkProjectStack } from '../lib/aws-cdk-project-stack';

const app = new cdk.App();

new AwsCdkProjectStack(app, 'AwsCdkProjectStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'ca-central-1',
  },
});