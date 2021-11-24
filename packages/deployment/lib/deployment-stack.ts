import * as cdk from "@aws-cdk/core";
import * as iam from "@aws-cdk/aws-iam";
import * as apigateway from "@aws-cdk/aws-apigatewayv2";
import * as lambda from "@aws-cdk/aws-lambda";
import * as cloudfront from "@aws-cdk/aws-cloudfront";
import * as origins from "@aws-cdk/aws-cloudfront-origins";

class WebSocketLambdaIntegration extends cdk.Construct {
  constructor(
    scope: cdk.Construct,
    id: string,
    props: {
      routeKey: string;
      apiId: string;
      handlerArn: string;
    }
  ) {
    super(scope, id);
    const stack = cdk.Stack.of(this);

    const role = new iam.Role(this, "Role", {
      assumedBy: new iam.ServicePrincipal("apigateway.amazonaws.com"),
    });
    role.addToPolicy(
      new iam.PolicyStatement({
        actions: ["lambda:InvokeFunction"],
        resources: [props.handlerArn],
      })
    );

    const integration = new apigateway.CfnIntegration(this, "Integration", {
      apiId: props.apiId,
      integrationType: "AWS_PROXY",
      integrationUri: `arn:aws:apigateway:${stack.region}:lambda:path/2015-03-31/functions/${props.handlerArn}/invocations`,
      credentialsArn: role.roleArn,
    });

    new apigateway.CfnRoute(this, "Route", {
      apiId: props.apiId,
      routeKey: props.routeKey,
      target: `integrations/${integration.ref}`,
    });
  }
}

export class DeploymentStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const api = new apigateway.CfnApi(this, "WebsocketGateway", {
      name: "websocket-gateway",
      protocolType: "WEBSOCKET",
      routeSelectionExpression: "\\$default",
    });

    const defaultRouteHandler = new lambda.Function(
      this,
      "DefaultRouteFunction",
      {
        runtime: lambda.Runtime.NODEJS_14_X,
        code: lambda.Code.fromAsset("../../package.zip"),
        handler: "default-handler.handler",
      }
    );

    const connectRouteHandler = new lambda.Function(this, "ConnectFunction", {
      runtime: lambda.Runtime.NODEJS_14_X,
      code: lambda.Code.fromAsset("../../package.zip"),
      handler: "connect-handler.handler",
    });

    const disconnectRouteHandler = new lambda.Function(
      this,
      "DisconnectFunction",
      {
        runtime: lambda.Runtime.NODEJS_14_X,
        code: lambda.Code.fromAsset("../../package.zip"),
        handler: "disconnect-handler.handler",
      }
    );

    new WebSocketLambdaIntegration(this, "DefaultIntegration", {
      apiId: api.ref,
      handlerArn: defaultRouteHandler.functionArn,
      routeKey: "$default",
    });

    new WebSocketLambdaIntegration(this, "ConnectIntegration", {
      apiId: api.ref,
      handlerArn: connectRouteHandler.functionArn,
      routeKey: "$connect",
    });

    new WebSocketLambdaIntegration(this, "DisconnectIntegration", {
      apiId: api.ref,
      handlerArn: disconnectRouteHandler.functionArn,
      routeKey: "$disconnect",
    });

    const stage = new apigateway.CfnStage(this, "WebSocketGatewayStage", {
      apiId: api.ref,
      stageName: "v1",
      autoDeploy: true,
      // TODO: log
    });

    const originRequestPolicy = new cloudfront.OriginRequestPolicy(
      this,
      "OriginRequestPolicy",
      {
        headerBehavior: cloudfront.OriginRequestHeaderBehavior.allowList(
          "Sec-WebSocket-Key",
          "Sec-WebSocket-Version",
          "Sec-WebSocket-Protocol",
          "Sec-WebSocket-Extensions"
        ),
        queryStringBehavior: cloudfront.OriginRequestQueryStringBehavior.all(),
      }
    );

    new cloudfront.Distribution(this, "Distribution", {
      defaultBehavior: {
        origin: new origins.HttpOrigin(
          `${api.ref}.execute-api.ap-northeast-1.amazonaws.com`,
          { originPath: `/${stage.stageName}` }
        ),
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: originRequestPolicy,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
        functionAssociations: [
          {
            function: new cloudfront.Function(this, "Function", {
              code: cloudfront.FunctionCode.fromFile({
                filePath: "../../packages/websocket/src/cloudfront-function.js",
              }),
            }),
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
          },
        ],
      },
      enableLogging: true,
    });
  }
}
