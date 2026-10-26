import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as rds from 'aws-cdk-lib/aws-rds';

export class AwsCdkProjectStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'VPC', {
      ipAddresses: ec2.IpAddresses.cidr('10.20.0.0/16'),
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
      ],
    });


    const albSG = new ec2.SecurityGroup(this, 'ALBSG', {
      vpc,
    });

    albSG.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80)
    );

    const ec2SG = new ec2.SecurityGroup(this, 'EC2SG', {
      vpc,
    });

    ec2SG.addIngressRule(
      albSG,
      ec2.Port.tcp(80)
    );

    const rdsSG = new ec2.SecurityGroup(this, 'RDSSG', {
      vpc,
      allowAllOutbound: false,
    });

    rdsSG.addIngressRule(
      ec2SG,
      ec2.Port.tcp(5432)
    );


    const launchTemplate = new ec2.LaunchTemplate(this, 'LaunchTemplate', {
      instanceType: new ec2.InstanceType(
        this.node.tryGetContext('instanceType') || 't3.micro'
      ),
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      securityGroup: ec2SG,
    });


    const autoScalingGroup = new autoscaling.AutoScalingGroup(this, 'ASG', {
      vpc,
      launchTemplate,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      minCapacity: 1,
      desiredCapacity: 2,
      maxCapacity: 4,
    });

  
    autoScalingGroup.scaleOnCpuUtilization('KeepSpareCPU', {
      targetUtilizationPercent: 50,
    });

  
    const alb = new elbv2.ApplicationLoadBalancer(this, 'ALB', {
      vpc,
      internetFacing: true,
      securityGroup: albSG,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
    });


    const listener = alb.addListener('Listener', {
      port: 80,
      open: false,
    });

    listener.addTargets('AppFleet', {
      port: 80,
      targets: [autoScalingGroup],
      healthCheck: {
        path: '/health',
      },
    });

    new rds.DatabaseInstance(this, 'Database', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16,
      }),
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [rdsSG],
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.MICRO
      ),
      allocatedStorage: 20,
      credentials: rds.Credentials.fromGeneratedSecret('postgres'),
      publiclyAccessible: false,
    });
  }
}