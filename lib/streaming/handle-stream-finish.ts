import { getChat, saveChat } from '@/lib/actions/chat'; // 替换 Redis 实现
import { generateRelatedQuestions } from '@/lib/agents/generate-related-questions';
import { ExtendedCoreMessage } from '@/lib/types';
import { convertToExtendedCoreMessages } from '@/lib/utils';
import { CoreMessage, DataStreamWriter, JSONValue, Message } from 'ai';

interface HandleStreamFinishParams {
  responseMessages: CoreMessage[];
  originalMessages: Message[];
  model: string;
  chatId: string;
  dataStream: DataStreamWriter;
  skipRelatedQuestions?: boolean;
  annotations?: ExtendedCoreMessage[];
}

export async function handleStreamFinish({
  responseMessages,
  originalMessages,
  model,
  chatId,
  dataStream,
  skipRelatedQuestions = false,
  annotations = []
}: HandleStreamFinishParams) {
  try {
    const extendedCoreMessages = convertToExtendedCoreMessages(originalMessages);
    let allAnnotations = [...annotations];

    if (!skipRelatedQuestions) {
      const relatedQuestionsAnnotation: JSONValue = {
        type: 'related-questions',
        data: { items: [] }
      };
      dataStream.writeMessageAnnotation(relatedQuestionsAnnotation);

      const relatedQuestions = await generateRelatedQuestions(responseMessages, model);
      const updatedRelatedQuestionsAnnotation: ExtendedCoreMessage = {
        role: 'data',
        content: {
          type: 'related-questions',
          data: relatedQuestions.object
        } as JSONValue
      };
      dataStream.writeMessageAnnotation(updatedRelatedQuestionsAnnotation.content as JSONValue);
      allAnnotations.push(updatedRelatedQuestionsAnnotation);
    }

    const generatedMessages = [
      ...extendedCoreMessages,
      ...responseMessages.slice(0, -1),
      ...allAnnotations,
      ...responseMessages.slice(-1)
    ] as ExtendedCoreMessage[];

    if (process.env.NEXT_PUBLIC_ENABLE_SAVE_CHAT_HISTORY !== 'true') {
      return;
    }

    const savedChat = (await getChat(chatId)) ?? {
      messages: [],
      createdAt: new Date(),
      userId: 'anonymous', // 这里可能需要动态用户 ID
      path: `/search/${chatId}`,
      title: originalMessages[0].content,
      id: chatId
    };

    await saveChat({
      ...savedChat,
      messages: generatedMessages
    }).catch(error => {
      console.error('Failed to save chat:', error);
      throw new Error('Failed to save chat history');
    });
  } catch (error) {
    console.error('Error in handleStreamFinish:', error);
    throw error;
  }
}