import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';

@Catch()
export class AllExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      response.status(exception.getStatus()).json(exception.response);
    } else {
      this.logger.error(
        `Request: ${request.method} ${request.url}
      Status: ${
        exception instanceof HttpException ? exception.getStatus() : 500
      }
      Message: ${exception['message']}
      User: ${request['user']}
      IP: ${request['ip']}
      Body: ${JSON.stringify(request.body, null, 2)}
      Exception: ${exception['stack']}`,
      );
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      response.status(500).json({
        statusCode: 500,
      });
    }
  }
}
