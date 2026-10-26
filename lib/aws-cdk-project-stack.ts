import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

export class AwsCdkProjectStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create VPC
    const vpc = new ec2.Vpc(this, 'MyVPC', {
      vpcName: 'DevOpsVPC',
      ipAddresses: ec2.IpAddresses.cidr('10.20.0.0/16'),
      maxAzs: 2,
      natGateways: 1,

      subnetConfiguration: [
        {
          name: 'PublicSubnet',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: 'PrivateSubnet',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
      ],
    });

    // ALB Security Group
    const albSG = new ec2.SecurityGroup(this, 'ALBSecurityGroup', {
      vpc,
      description: 'Security Group for Application Load Balancer',
      allowAllOutbound: true,
    });

    albSG.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'Allow HTTP from internet'
    );

    // EC2 Security Group
    const ec2SG = new ec2.SecurityGroup(this, 'EC2SecurityGroup', {
      vpc,
      description: 'Security Group for EC2 instances',
      allowAllOutbound: true,
    });

    ec2SG.addIngressRule(
      albSG,
      ec2.Port.tcp(80),
      'Allow HTTP only from ALB'
    );

    // RDS Security Group
    const rdsSG = new ec2.SecurityGroup(this, 'RDSSecurityGroup', {
      vpc,
      description: 'Security Group for RDS PostgreSQL',
      allowAllOutbound: false,
    });

    rdsSG.addIngressRule(
      ec2SG,
      ec2.Port.tcp(5432),
      'Allow PostgreSQL only from EC2'
    );

    // CloudFormation Outputs
    new cdk.CfnOutput(this, 'VpcId', {
      value: vpc.vpcId,
    });

    new cdk.CfnOutput(this, 'ALBSecurityGroupId', {
      value: albSG.securityGroupId,
    });

    new cdk.CfnOutput(this, 'EC2SecurityGroupId', {
      value: ec2SG.securityGroupId,
    });

    new cdk.CfnOutput(this, 'RDSSecurityGroupId', {
      value: rdsSG.securityGroupId,
    });
  }
}