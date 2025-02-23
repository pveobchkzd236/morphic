import { Message } from 'ai';
import { Button } from './ui/button'; // 假设 Morphic 有类似的按钮组件

interface SuggestedQuestionsProps {
    messages: Message[]; // AI 的回答，用于猜测问题
  onSelect: (question: string) => void; // 用户点击选项后的回调
}

export default function SuggestedQuestions({ messages, onSelect }: SuggestedQuestionsProps) {
  // 简单模拟基于 AI 回答的建议问题（这里用硬编码，后续可以动态生成）
  const suggestions = [
    'Can you explain this in more detail?',
    'What are the alternatives?',
    'How does this work?',
    'Can you provide examples?',
  ];

  return (
<div className="relative mx-auto px-4 w-full mb-4"> {/* 模仿 ChatMessages 的外层布局 */}
      <div className="rounded-lg shadow-md p-4"> {/* 卡片样式，无背景色，依赖主题 */}
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Suggested Questions:</h3>
        <div className="flex flex-col gap-4"> {/* 垂直排列，间距与 ChatMessages 一致 */}
          {suggestions.map((question, index) => (
            <Button
              key={index}
              onClick={() => onSelect(question)}
              className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-md hover:bg-gray-700 dark:hover:bg-gray-200 w-full text-left py-2 px-4"
            >
              {question}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}