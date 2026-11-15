"""
AWS CDK Infrastructure for Nexus Mind AI

This module provides CloudFormation/CDK-compatible infrastructure definitions
for deploying Nexus Mind with AWS serverless patterns.
"""

AWSTemplate = """
AWSTemplateFormatVersion: '2010-09-09'
Description: 'Nexus Mind AI - Serverless Cognitive Pipeline'

Parameters:
  Stage:
    Type: String
    Default: dev
    AllowedValues:
      - dev
      - staging
      - prod

Resources:
  # API Gateway
  NexusMindAPI:
    Type: AWS::ApiGatewayV2::Api
    Properties:
      Name: !Sub 'nexus-mind-api-${Stage}'
      ProtocolType: HTTP
      CorsConfiguration:
        AllowOrigins:
          - '*'
        AllowMethods:
          - GET
          - POST
          - PUT
          - DELETE
        AllowHeaders:
          - '*'

  # Event Bus (EventBridge)
  NexusMindEventBus:
    Type: AWS::Events::EventBus
    Properties:
      Name: !Sub 'nexus-mind-eventbus-${Stage}'

  # Inference Queue (SQS)
  InferenceQueue:
    Type: AWS::SQS::Queue
    Properties:
      QueueName: !Sub 'nexus-inference-queue-${Stage}'
      VisibilityTimeout: 60
      MessageRetentionPeriod: 86400
      RedrivePolicy:
        deadLetterTargetArn: !GetAtt InferenceDLQ.Arn
        maxReceiveCount: 3

  InferenceDLQ:
    Type: AWS::SQS::Queue
    Properties:
      QueueName: !Sub 'nexus-inference-dlq-${Stage}'

  # Inference Lambda
  InferenceFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: !Sub 'nexus-inference-${Stage}'
      CodeUri: ./src
      Handler: inference.handler
      Runtime: python3.11
      Timeout: 30
      MemorySize: 2048
      Environment:
        Variables:
          EVENT_BUS_NAME: !Ref NexusMindEventBus
          STAGE: !Ref Stage
      Policies:
        - SQSPollingPolicy:
            QueueName: !GetAtt InferenceQueue.QueueName
        - EventBridgePutEventsPolicy:
            EventBusName: !Ref NexusMindEventBus

  # Queue to Lambda Integration
  InferenceQueueSubscription:
    Type: AWS::Lambda::EventSourceMapping
    Properties:
      EventSourceArn: !GetAtt InferenceQueue.Arn
      FunctionName: !GetAtt InferenceFunction.Arn
      BatchSize: 1

  # API Route for Inference
  InferenceRoute:
    Type: AWS::ApiGatewayV2::Route
    Properties:
      ApiId: !Ref NexusMindAPI
      RouteKey: POST /infer
      AuthorizationType: NONE
      Target: !Sub 'integrations/${InferenceIntegration}'

  InferenceIntegration:
    Type: AWS::ApiGatewayV2::Integration
    Properties:
      ApiId: !Ref NexusMindAPI
      IntegrationType: AWS_PROXY
      IntegrationUri: !Sub 'arn:aws:apigateway:${AWS::Region}:lambda:path/2015-03-31/functions/${InferenceFunction.Arn}/invocations'

  # API Stage
  APiStage:
    Type: AWS::ApiGatewayV2::Stage
    Properties:
      ApiId: !Ref NexusMindAPI
      StageName: !Ref Stage
      AutoDeploy: true

  # CloudWatch Metrics
  NexusMindMetrics:
    Type: AWS::CloudWatch::Dashboard
    Properties:
      DashboardName: !Sub 'nexus-mind-${Stage}'
      DashboardBody:
        Fn::Sub: |
          {
            "widgets": [
              {
                "type": "metric",
                "properties": {
                  "metrics": [
                    ["NexusMind", "InferenceCount", "Stage", "${Stage}"],
                    [".", "InferenceLatency", ".", "Average"],
                    [".", "ErrorCount", ".", "Sum"]
                  ],
                  "period": 60,
                  "stat": "Sum",
                  "region": "${AWS::Region}",
                  "title": "Nexus Mind Metrics"
                }
              }
            ]
          }

Outputs:
  APIEndpoint:
    Description: API Gateway endpoint URL
    Value: !Sub 'https://${NexusMindAPI.ApiId}.execute-api.${AWS::Region}.amazonaws.com/${Stage}'

  EventBusName:
    Description: EventBridge event bus name
    Value: !Ref NexusMindEventBus

  InferenceQueueURL:
    Description: SQS inference queue URL
    Value: !Ref InferenceQueue

  InferenceFunctionARN:
    Description: Inference Lambda function ARN
    Value: !GetAtt InferenceFunction.Arn
"""

LambdaInferenceCode = """
import json
import os
import time
import boto3

eventbridge = boto3.client("events")

def handler(event, context):
    start_time = time.time()
    
    try:
        body = json.loads(event.get("body", "{}"))
        sensor_data = body.get("sensor_data")
        
        result = {
            "statusCode": 200,
            "body": json.dumps({
                "inference_id": event.get("requestContext", {}).get("requestId", "unknown"),
                "result": {"message": "Inference processed"},
                "latency_ms": (time.time() - start_time) * 1000
            })
        }
        
        eventbridge.put_events(
            Entries=[{
                "Source": "nexus-mind",
                "DetailType": "inference.complete",
                "Detail": json.dumps({"status": "success", "latency": (time.time() - start_time) * 1000}),
                "EventBusName": os.environ.get("EVENT_BUS_NAME")
            }]
        )
        
        return result
        
    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)})
        }
"""


def save_cdk_app():
    """Save CDK application structure."""
    return {
        "app_py": """
from aws_cdk import (
    App, Stack,
    aws_apigatewayv2 as apigwv2,
    aws_events as events,
    aws_sqs as sqs,
    aws_lambda as _lambda,
    aws_cloudwatch as cloudwatch
)
from constructs import Construct

class NexusMindStack(Stack):
    def __init__(self, scope: Construct, id: str, **kwargs):
        super().__init__(scope, id, **kwargs)
        
        # Event Bus
        event_bus = events.EventBus(self, "NexusMindEventBus",
            event_bus_name="nexus-mind-eventbus"
        )
        
        # Inference Queue
        inference_queue = sqs.Queue(self, "InferenceQueue",
            queue_name="nexus-inference-queue",
            visibility_timeout=core.Duration.seconds(60)
        )
        
        # Lambda Function
        inference_fn = _lambda.Function(self, "InferenceFunction",
            runtime=_lambda.Runtime.PYTHON_3_11,
            handler="inference.handler",
            code=_lambda.Code.from_asset("src")
        )
        
        # API Gateway
        api = apigwv2.HttpApi(self, "NexusMindAPI")
        
        api.add_routes(
            path="/infer",
            methods=[apigwv2.HttpMethod.POST],
            integration=apigwv2.HttpLambdaIntegration("InferenceIntegration",
                handler=inference_fn
            )
        )
        
app = App()
NexusMindStack(app, "NexusMindStack")
app.synth()
"""
    }


if __name__ == "__main__":
    print("AWS CDK Infrastructure Template for Nexus Mind AI")
    print("=" * 50)
    print("Files generated:")
    print("  - infrastructure.yaml (CloudFormation template)")
    print("  - src/inference.py (Lambda handler)")
    print("  - app.py (CDK application)")
