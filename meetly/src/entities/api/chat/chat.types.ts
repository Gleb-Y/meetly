export type ChatMessage = {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  isRead: boolean;
  createdAt: string;
  sender: {
    id: string;
    username: string | null;
    firstName: string | null;
    avatar: string | null;
  };
};

export type Chat = {
  id: string;
  eventId: string;
  event: {
    id: string;
    title: string;
    category: string;
  };
  lastMessage: ChatMessage | null;
  unreadCount: number;
  messages: ChatMessage[];
  participantsCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ChatsListResponse = Chat[];

export type ChatFilter =
  | "all"
  | "unread"
  | "party"
  | "gym"
  | "basketball"
  | "cocktail";
