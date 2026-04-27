import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';

describe('ChatGateway', () => {
  let gateway: ChatGateway;
  let chatService: {
    sendSystemMessage: jest.Mock;
    sendMessage: jest.Mock;
    getMessageReadUsers: jest.Mock;
    markChatAsRead: jest.Mock;
    markChatAsReadWithDetails: jest.Mock;
    getMessageReaders: jest.Mock;
    getChatUserPreview: jest.Mock;
    getChat: jest.Mock;
    toggleReaction: jest.Mock;
  };

  beforeEach(async () => {
    chatService = {
      sendSystemMessage: jest.fn(),
      sendMessage: jest.fn(),
      getMessageReadUsers: jest.fn(),
      markChatAsRead: jest.fn(),
      markChatAsReadWithDetails: jest.fn(),
      getMessageReaders: jest.fn(),
      getChatUserPreview: jest.fn(),
      getChat: jest.fn(),
      toggleReaction: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatGateway,
        { provide: ChatService, useValue: chatService },
        { provide: JwtService, useValue: { verify: jest.fn(), sign: jest.fn() } },
      ],
    }).compile();

    gateway = module.get<ChatGateway>(ChatGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  it('broadcastSystemMessage keeps sender isRead=false without focused recipient', async () => {
    chatService.sendSystemMessage.mockResolvedValue({
      id: 'm1',
      content: 'joined',
      isRead: false,
      readByCount: 0,
    });
    chatService.getMessageReadUsers.mockResolvedValue(new Set(['sender-id']));

    const emitSender = jest.fn();
    const emitOther = jest.fn();
    const emitAnon = jest.fn();
    const sockets = [
      { id: 'sender-socket', data: { userId: 'sender-id' }, emit: emitSender },
      { id: 'other-socket', data: { userId: 'other-id' }, emit: emitOther },
      { id: 'anon-socket', data: {}, emit: emitAnon },
    ];

    const fetchSockets = jest.fn().mockResolvedValue(sockets);
    gateway.server = {
      in: jest.fn().mockReturnValue({ fetchSockets }),
    } as any;

    await gateway.broadcastSystemMessage('chat-1', 'sender-id', 'joined');

    expect(gateway.server.in).toHaveBeenCalledWith('chat:chat-1');
    expect(emitSender).toHaveBeenCalledWith(
      'newMessage',
      expect.objectContaining({ isRead: false }),
    );
    expect(emitOther).toHaveBeenCalledWith(
      'newMessage',
      expect.objectContaining({ isRead: false }),
    );
    expect(emitAnon).not.toHaveBeenCalled();
  });

  it('handleSendMessage emits recipient-personalized isRead and skips anonymous sockets', async () => {
    chatService.sendMessage.mockResolvedValue({
      id: 'm2',
      chatId: 'chat-1',
      senderId: 'sender-id',
      content: 'hello',
      isRead: false,
      readByCount: 0,
    });
    chatService.getMessageReadUsers.mockResolvedValue(new Set(['sender-id']));

    const emitSender = jest.fn();
    const emitOther = jest.fn();
    const emitAnon = jest.fn();
    const sockets = [
      { id: 'sender-socket', data: { userId: 'sender-id' }, emit: emitSender },
      { id: 'other-socket', data: { userId: 'other-id' }, emit: emitOther },
      { id: 'anon-socket', data: {}, emit: emitAnon },
    ];
    gateway.server = {
      in: jest.fn().mockReturnValue({ fetchSockets: jest.fn().mockResolvedValue(sockets) }),
    } as any;

    const response = await gateway.handleSendMessage(
      { data: { userId: 'sender-id' } } as any,
      { chatId: 'chat-1', content: 'hello', tempId: 'tmp-1' },
    );

    expect(response.success).toBe(true);
    expect(chatService.getMessageReadUsers).toHaveBeenCalledWith('m2', [
      'sender-id',
      'other-id',
    ]);
    expect(emitSender).toHaveBeenCalledWith(
      'newMessage',
      expect.objectContaining({ isRead: false, tempId: 'tmp-1' }),
    );
    expect(emitOther).toHaveBeenCalledWith(
      'newMessage',
      expect.objectContaining({ isRead: false, tempId: 'tmp-1' }),
    );
    expect(emitAnon).not.toHaveBeenCalled();
  });

  it('handleSendMessage forwards audio fields to chatService for voice-only messages', async () => {
    chatService.sendMessage.mockResolvedValue({
      id: 'm-voice',
      chatId: 'chat-1',
      senderId: 'sender-id',
      content: '',
      audioUrl: 'https://cdn.example.com/voice.m4a',
      isRead: false,
      readByCount: 0,
    });
    chatService.getMessageReadUsers.mockResolvedValue(new Set());

    gateway.server = {
      in: jest.fn().mockReturnValue({
        fetchSockets: jest.fn().mockResolvedValue([
          {
            id: 'sender-socket',
            data: { userId: 'sender-id' },
            emit: jest.fn(),
          },
        ]),
      }),
    } as any;

    const response = await gateway.handleSendMessage(
      { data: { userId: 'sender-id' } } as any,
      {
        chatId: 'chat-1',
        content: '',
        tempId: 'tmp-voice',
        audioUrl: 'https://cdn.example.com/voice.m4a',
        audioDurationMs: 3200,
        audioMimeType: 'audio/mp4',
        audioSizeBytes: 45000,
      },
    );

    expect(response.success).toBe(true);
    expect(chatService.sendMessage).toHaveBeenCalledWith(
      'chat-1',
      'sender-id',
      '',
      undefined,
      undefined,
      'https://cdn.example.com/voice.m4a',
      3200,
      'audio/mp4',
      45000,
    );
  });

  it('handleSendMessage marks sender payload read=true when another participant is focused in chat', async () => {
    chatService.getChat.mockResolvedValue({ id: 'chat-1' });
    chatService.sendMessage.mockResolvedValue({
      id: 'm3',
      chatId: 'chat-1',
      senderId: 'sender-id',
      content: 'focused',
      isRead: false,
      readByCount: 0,
    });
    chatService.getMessageReadUsers.mockResolvedValue(new Set());

    const emitSender = jest.fn();
    const emitOther = jest.fn();
    gateway.server = {
      in: jest.fn().mockReturnValue({
        fetchSockets: jest.fn().mockResolvedValue([
          {
            id: 'sender-socket',
            data: { userId: 'sender-id' },
            emit: emitSender,
          },
          { id: 'other-socket', data: { userId: 'other-id' }, emit: emitOther },
        ]),
      }),
    } as any;

    await gateway.handleJoinChat(
      { id: 'other-socket', data: { userId: 'other-id' }, join: jest.fn(), to: jest.fn().mockReturnValue({ emit: jest.fn() }) } as any,
      { chatId: 'chat-1' },
    );

    await gateway.handleSendMessage(
      { data: { userId: 'sender-id' } } as any,
      { chatId: 'chat-1', content: 'focused' },
    );

    expect(emitSender).toHaveBeenCalledWith(
      'newMessage',
      expect.objectContaining({ isRead: true }),
    );
    expect(emitOther).toHaveBeenCalledWith(
      'newMessage',
      expect.objectContaining({ isRead: false }),
    );
  });

  it('handleMarkAsRead rejects when socket is not focused on chat', async () => {
    const result = await gateway.handleMarkAsRead(
      { id: 'socket-1', data: { userId: 'u1' }, to: jest.fn() } as any,
      { chatId: 'chat-1' },
    );

    expect(result).toEqual({ success: false, error: 'Chat is not focused' });
    expect(chatService.markChatAsReadWithDetails).not.toHaveBeenCalled();
  });

  it('handleLeaveChat leaves room and clears focus for strict markAsRead gate', async () => {
    chatService.getChat.mockResolvedValue({ id: 'chat-1' });
    chatService.markChatAsReadWithDetails.mockResolvedValue({
      success: true,
      count: 1,
      messageIds: ['m1'],
      readAt: new Date('2026-01-01T10:00:00.000Z'),
    });
    const emit = jest.fn();
    gateway.server = {
      to: jest.fn().mockReturnValue({ emit }),
    } as any;
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const client = {
      id: 'socket-1',
      data: { userId: 'u1' },
      join: jest.fn(),
      leave: jest.fn().mockResolvedValue(undefined),
      to: jest.fn().mockReturnValue({ emit: jest.fn() }),
    } as any;

    await gateway.handleJoinChat(client, { chatId: 'chat-1' });
    await gateway.handleLeaveChat(client, { chatId: 'chat-1' });
    const result = await gateway.handleMarkAsRead(client, { chatId: 'chat-1' });

    expect(client.leave).toHaveBeenCalledWith('chat:chat-1');
    expect(logSpy).toHaveBeenCalledWith('User u1 left room chat-1');
    expect(result).toEqual({ success: false, error: 'Chat is not focused' });

    logSpy.mockRestore();
  });

  it('handleDisconnect clears focused chat state for socket', async () => {
    chatService.getChat.mockResolvedValue({ id: 'chat-1' });
    gateway.server = {
      to: jest.fn().mockReturnValue({ emit: jest.fn() }),
    } as any;

    const client = {
      id: 'socket-1',
      data: { userId: 'u1' },
      join: jest.fn(),
      to: jest.fn().mockReturnValue({ emit: jest.fn() }),
    } as any;

    await gateway.handleJoinChat(client, { chatId: 'chat-1' });
    gateway.handleDisconnect(client);
    const result = await gateway.handleMarkAsRead(client, { chatId: 'chat-1' });

    expect(result).toEqual({ success: false, error: 'Chat is not focused' });
  });

  it('handleMarkAsRead emits legacy and detailed read events', async () => {
    const emit = jest.fn();
    chatService.getChat.mockResolvedValue({ id: 'chat-1' });
    chatService.markChatAsReadWithDetails.mockResolvedValue({
      success: true,
      count: 2,
      messageIds: ['m1', 'm2'],
      readAt: new Date('2026-01-01T11:00:00.000Z'),
    });
    chatService.getChatUserPreview.mockResolvedValue({
      userId: 'u1',
      username: 'alex',
      avatar: 'https://avatar',
    });

    const client = {
      id: 'socket-1',
      data: { userId: 'u1' },
      join: jest.fn(),
      to: jest.fn().mockReturnValue({ emit }),
    } as any;

    await gateway.handleJoinChat(client, { chatId: 'chat-1' });
    const result = await gateway.handleMarkAsRead(client, { chatId: 'chat-1' });

    expect(result).toEqual({
      success: true,
      count: 2,
      messageIds: ['m1', 'm2'],
      readAt: new Date('2026-01-01T11:00:00.000Z'),
    });
    expect(chatService.markChatAsReadWithDetails).toHaveBeenCalledWith(
      'chat-1',
      'u1',
    );
    expect(emit).toHaveBeenCalledWith('messagesRead', {
      userId: 'u1',
      chatId: 'chat-1',
    });
    expect(emit).toHaveBeenCalledWith('messageReadUpdate', {
      chatId: 'chat-1',
      reader: {
        userId: 'u1',
        username: 'alex',
        avatar: 'https://avatar',
      },
      messageIds: ['m1', 'm2'],
      readAt: new Date('2026-01-01T11:00:00.000Z'),
    });
  });

  it('handleGetMessageReaders returns and emits readers payload', async () => {
    const emit = jest.fn();
    chatService.getMessageReaders.mockResolvedValue({
      messageId: 'm1',
      readers: [
        {
          userId: 'u2',
          username: 'nick',
          avatar: 'https://avatar',
          readAt: new Date('2026-01-01T12:00:00.000Z'),
        },
      ],
    });

    const result = await gateway.handleGetMessageReaders(
      { data: { userId: 'u1' }, emit } as any,
      { messageId: 'm1' },
    );

    expect(chatService.getMessageReaders).toHaveBeenCalledWith('m1', 'u1');
    expect(emit).toHaveBeenCalledWith('messageReaders', {
      messageId: 'm1',
      readers: [
        {
          userId: 'u2',
          username: 'nick',
          avatar: 'https://avatar',
          readAt: new Date('2026-01-01T12:00:00.000Z'),
        },
      ],
    });
    expect(result).toEqual({
      success: true,
      messageId: 'm1',
      readers: [
        {
          userId: 'u2',
          username: 'nick',
          avatar: 'https://avatar',
          readAt: new Date('2026-01-01T12:00:00.000Z'),
        },
      ],
    });
  });

  it('handleReaction toggles reaction and emits reactionUpdated to chat room', async () => {
    const emit = jest.fn();
    const to = jest.fn().mockReturnValue({ emit });
    gateway.server = { to } as any;

    chatService.toggleReaction.mockResolvedValue({
      action: 'added',
      chatId: 'chat-1',
      reaction: {
        emoji: '👍',
        userId: 'u1',
        user: { id: 'u1', username: 'alex', avatar: 'https://av' },
      },
    });

    const result = await gateway.handleReaction(
      { data: { userId: 'u1' } } as any,
      { messageId: 'm1', emoji: '👍' },
    );

    expect(chatService.toggleReaction).toHaveBeenCalledWith('m1', 'u1', '👍');
    expect(to).toHaveBeenCalledWith('chat:chat-1');
    expect(emit).toHaveBeenCalledWith('reactionUpdated', {
      messageId: 'm1',
      emoji: '👍',
      userId: 'u1',
      action: 'added',
      user: { id: 'u1', username: 'alex', avatar: 'https://av' },
    });
    expect(result).toEqual({ success: true });
  });

  it('handleReaction includes previousEmoji when action is replaced', async () => {
    const emit = jest.fn();
    gateway.server = {
      to: jest.fn().mockReturnValue({ emit }),
    } as any;

    chatService.toggleReaction.mockResolvedValue({
      action: 'replaced',
      chatId: 'chat-1',
      previousEmoji: '👎',
      reaction: {
        emoji: '👍',
        userId: 'u1',
        user: { id: 'u1', username: 'alex', avatar: null },
      },
    });

    await gateway.handleReaction(
      { data: { userId: 'u1' } } as any,
      { messageId: 'm1', emoji: '👍' },
    );

    expect(emit).toHaveBeenCalledWith(
      'reactionUpdated',
      expect.objectContaining({
        messageId: 'm1',
        emoji: '👍',
        userId: 'u1',
        action: 'replaced',
        previousEmoji: '👎',
        user: { id: 'u1', username: 'alex', avatar: null },
      }),
    );
  });
});
