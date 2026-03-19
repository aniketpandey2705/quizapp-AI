import React from 'react';
import { CheckCircle2, XCircle, Info, Loader2, BookOpen } from 'lucide-react';

const QuestionCard = ({ 
  question, 
  userAnswer, 
  onSelect, 
  onShowSolution, 
  solution, 
  isLoadingSolution,
  isResolved 
}) => {
  const isCorrect = userAnswer === solution?.correctAnswer;
  const isWrong = userAnswer && solution?.correctAnswer && userAnswer !== solution?.correctAnswer;

  return (
    <div className={`p-6 mb-6 rounded-2xl border transition-all duration-500 hover:shadow-xl ${
      isCorrect ? 'border-green-500 bg-green-500/5 shadow-lg shadow-green-500/10' :
      isWrong ? 'border-red-500 bg-red-500/5 shadow-lg shadow-red-500/10' :
      'border-border bg-card'
    }`}>
      <div className="flex justify-between items-start mb-4">
        <span className="text-xs font-bold px-3 py-1 bg-primary/10 text-primary rounded-full uppercase tracking-widest">
          Q{question.id}
        </span>
        {isCorrect && <CheckCircle2 className="w-6 h-6 text-green-500 animate-in zoom-in duration-300" />}
        {isWrong && <XCircle className="w-6 h-6 text-red-500 animate-in zoom-in duration-300" />}
      </div>

      <h3 className="text-xl font-semibold mb-6 text-foreground leading-snug">{question.text}</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {question.options.map((option, idx) => {
          const isSelected = userAnswer === option;
          const isCorrectOption = solution?.correctAnswer === option;
          const showResult = !!solution;

          let btnClass = "w-full text-left p-4 rounded-xl border transition-all duration-300 flex items-center justify-between group ";
          if (isSelected) {
            btnClass += isCorrectOption ? "bg-green-500/20 border-green-500 text-green-700 dark:text-green-300 " : 
                        (showResult ? "bg-red-500/20 border-red-500 text-red-700 dark:text-red-300 " : "bg-primary/20 border-primary text-primary ");
          } else if (showResult && isCorrectOption) {
            btnClass += "bg-green-500/10 border-green-500/50 text-green-600 dark:text-green-400 ";
          } else {
            btnClass += "bg-background/40 border-border hover:border-primary/50 text-foreground/70 ";
          }

          return (
            <button
              key={idx}
              onClick={() => onSelect(option)}
              disabled={!!solution}
              className={btnClass}
            >
              <span className="font-medium">{option}</span>
              {isSelected && !showResult && <div className="w-2 h-2 rounded-full bg-primary" />}
              {showResult && isCorrectOption && <CheckCircle2 className="w-5 h-5" />}
              {isSelected && showResult && !isCorrectOption && <XCircle className="w-5 h-5" />}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-4">
        {!solution && (
          <button
            onClick={onShowSolution}
            disabled={!isResolved || !userAnswer}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${
              !isResolved || !userAnswer ? 'opacity-40 cursor-not-allowed bg-secondary' : 'bg-primary text-primary-foreground hover:scale-105 active:scale-95 shadow-lg shadow-primary/20'
            }`}
          >
            {isLoadingSolution ? <Loader2 className="w-5 h-5 animate-spin" /> : <BookOpen className="w-5 h-5" />}
            {isResolved ? 'Show Detailed Solution' : 'Solving...'}
          </button>
        )}
        {solution && (
           <button
           onClick={onShowSolution}
           className="text-sm font-bold text-primary hover:underline"
         >
           Hide Solution
         </button>
        )}
      </div>

      {solution && (
        <div className="mt-8 p-6 rounded-2xl bg-gradient-to-br from-primary/5 to-transparent border border-primary/20 space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex items-center gap-3 text-primary">
            <div className="p-1.5 bg-primary/10 rounded-lg">
              <Info className="w-5 h-5" />
            </div>
            <span className="font-bold text-lg">Step-by-Step Breakdown</span>
          </div>
          <p className="text-base leading-relaxed text-foreground/80 font-medium">{solution.explanation}</p>
          <div className="pt-4 border-t border-primary/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
               <span className="text-xs font-black text-primary/40 uppercase tracking-widest">Core Concept</span>
               <span className="text-sm font-bold text-foreground px-2 py-0.5 bg-background rounded-md border border-border">{solution.concept}</span>
            </div>
            <CheckCircle2 className="w-8 h-8 text-green-500/20" />
          </div>
        </div>
      )}
    </div>

  );
};

export default QuestionCard;
