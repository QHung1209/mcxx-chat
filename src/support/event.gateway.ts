import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { BaseAuthService } from './services/base-auth.service';

@WebSocketGateway({ cors: true, transports: ['websocket'] })
export class EventGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly baseAuthService: BaseAuthService) {}

  handleEmitSocket(payload: any): void {
    const { data, event, to } = payload;
    this.server.to(String(to)).emit(event, data);
  }

  handleEmitToChat(chatId: number, event: string, data: any): void {
    this.server.to(`chat:${chatId}`).emit(event, data);
  }

  @SubscribeMessage('JOIN_CHAT')
  handleJoinChat(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { chatId: number },
  ) {
    socket.join(`chat:${data.chatId}`);
  }

  @SubscribeMessage('LEAVE_CHAT')
  handleLeaveChat(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { chatId: number },
  ) {
    socket.leave(`chat:${data.chatId}`);
  }

  @SubscribeMessage('TYPING')
  handleTyping(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { chatId: number; isTyping: boolean },
  ) {
    socket.to(`chat:${data.chatId}`).emit('TYPING', {
      chatId: data.chatId,
      userId: socket.data.userId,
      isTyping: data.isTyping,
    });
  }

  // @SubscribeMessage('JOIN_BOARD')
  // async typingTopic(@ConnectedSocket() socket: Socket, @Req() req) {
  //   const customerId = socket.data.customer.id;
  //   if (typeof socket.data.boardId != 'undefined') {
  //     socket.leave(socket.data.boardId);
  //   }
  //   if (checkBoard) {
  //     console.log('JOIN BOARD', req.body.boardId);
  //     socket.data.boardId = req.body.boardId;
  //     socket.join(String(req.body.boardId));
  //   } else {
  //     socket.disconnect();
  //   }
  // }
  //
  // @SubscribeMessage('OUT_BOARD')
  // async handleOutTopicSocket(socket: Socket) {
  //   if (typeof socket.data.boardId != 'undefined') {
  //     socket.leave(socket.data.boardId);
  //     socket.data.boardId = undefined;
  //   }
  //   return {
  //     statusCode: 200,
  //   };
  // }

  async handleConnection(socket: Socket): Promise<any> {
    const authHeaders = socket.handshake.query.token;
    if (authHeaders && (authHeaders as string).split(' ')[1]) {
      if (typeof socket.data.userId == 'undefined') {
        try {
          const userId = await this.baseAuthService.handleAuthMiddleware(
            authHeaders,
            socket.handshake.query.scope,
          );
          socket.data.userId = userId;
          socket.join(String(userId));
          console.log('connect-success', String(userId));
        } catch ($e) {
          console.log($e);
          socket.disconnect();
        }
      }
    } else {
      socket.disconnect();
    }
  }

  async handleDisconnect(@ConnectedSocket() socket: Socket) {
    console.log('DISCONNECT', socket.id);
  }
}
