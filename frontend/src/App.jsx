import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BrainCircuit, Loader2, BookOpen, Sparkles, CheckCircle2, XCircle, Info, Settings } from 'lucide-react';
import QuestionCard from './components/QuestionCard';

const API_BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';

function App() {
  const [questions, setQuestions] = useState([]);
  const [userAnswers, setUserAnswers] = useState({});
  const [solutions, setSolutions] = useState({});
  const [loading, setLoading] = useState(true);
  
  // Settings & Configuration
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('plaquiz_api_key') || '');
  const [aiModel, setAiModel] = useState(() => localStorage.getItem('plaquiz_model') || 'openai/gpt-3.5-turbo');

  // Pagination & Batch Solving
  const [currentPage, setCurrentPage] = useState(0);
  const [isBatchSolving, setIsBatchSolving] = useState(false);
  const questionsPerPage = 5;

  useEffect(() => {
    localStorage.setItem('plaquiz_api_key', apiKey);
    localStorage.setItem('plaquiz_model', aiModel);
  }, [apiKey, aiModel]);

  useEffect(() => {
    fetchQuestions();
  }, []);

  useEffect(() => {
    if (questions.length > 0) {
      preSolveCurrentBatch();
      preFetchNextBatch();
    }
  }, [currentPage, questions]);

  const fetchQuestions = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE}/questions`);
      setQuestions(res.data);
    } catch (err) {
      console.error("Error fetching questions:", err);
    } finally {
      setLoading(false);
    }
  };

  const solveBatchInternal = async (batch) => {
    const unsolvedInBatch = batch.filter(q => !solutions[q.id]);
    if (unsolvedInBatch.length === 0) return;

    try {
      const headers = {};
      if (apiKey) headers['x-api-key'] = apiKey;
      if (aiModel) headers['x-model'] = aiModel;

      const res = await axios.post(`${API_BASE}/solve-batch`, { questions: batch }, { headers });
      const newSolutions = {};
      res.data.results.forEach(sol => {
        newSolutions[sol.id] = sol;
      });
      setSolutions(prev => ({ ...prev, ...newSolutions }));
    } catch (err) {
      console.error("Error solving batch:", err);
    }
  };

  const preSolveCurrentBatch = async () => {
    const start = currentPage * questionsPerPage;
    const currentBatch = questions.slice(start, start + questionsPerPage);
    
    setIsBatchSolving(true);
    await solveBatchInternal(currentBatch);
    setIsBatchSolving(false);
  };

  const preFetchNextBatch = async () => {
    const nextStart = (currentPage + 1) * questionsPerPage;
    if (nextStart >= questions.length) return;
    
    const nextBatch = questions.slice(nextStart, nextStart + questionsPerPage);
    solveBatchInternal(nextBatch);
  };

  const handleSelect = (questionId, option) => {
    if (solutions[questionId]?.show) return;
    setUserAnswers(prev => ({ ...prev, [questionId]: option }));
  };

  const toggleSolution = (questionId) => {
    setSolutions(prev => ({
      ...prev,
      [questionId]: { ...prev[questionId], show: !prev[questionId]?.show }
    }));
  };

  const handleNextPage = () => {
    if ((currentPage + 1) * questionsPerPage < questions.length) {
      setCurrentPage(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(prev => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const currentQuestions = questions.slice(currentPage * questionsPerPage, (currentPage + 1) * questionsPerPage);
  
  const score = Object.keys(solutions).reduce((acc, qId) => {
    if (userAnswers[qId] === solutions[qId]?.correctAnswer) return acc + 1;
    return acc;
  }, 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
          <p className="text-foreground/60 font-medium font-sans">Loading Aptitude Questions...</p>
        </div>
      </div>
    );
  }

  if (!apiKey) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full glass p-10 rounded-[2.5rem] border border-primary/20 text-center shadow-2xl animate-in zoom-in-95 duration-500">
          <div className="inline-flex items-center justify-center p-5 mb-8 rounded-3xl bg-primary/10 text-primary animate-bounce">
            <BrainCircuit className="w-16 h-16" />
          </div>
          <h1 className="text-4xl font-black mb-4">Setup Required</h1>
          <p className="text-foreground/60 mb-10 leading-relaxed">
            Welcome to <span className="text-primary font-bold">Plaquiz AI</span>. To start solving 120+ aptitude questions with AI, please configure your OpenRouter API Key first.
          </p>
          <button 
            onClick={() => setShowSettings(true)}
            className="w-full py-5 bg-primary text-primary-foreground font-black rounded-2xl flex items-center justify-center gap-3 hover:scale-105 active:scale-95 transition-all shadow-xl shadow-primary/30 text-lg"
          >
            <Settings className="w-6 h-6" />
            Configure AI Settings
          </button>
          
          {showSettings && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-300">
              <div className="w-full max-w-md glass p-8 rounded-3xl border border-primary/30 shadow-2xl relative animate-in zoom-in-95 duration-300 text-left">
                <button 
                  onClick={() => setShowSettings(false)}
                  className="absolute right-4 top-4 p-2 hover:bg-primary/10 rounded-xl transition-colors"
                >
                  <XCircle className="w-6 h-6 text-foreground/40" />
                </button>
                
                <div className="flex items-center gap-3 mb-6">
                  <Settings className="w-6 h-6 text-primary" />
                  <h2 className="text-2xl font-bold">AI Configuration</h2>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-foreground/60 uppercase tracking-widest mb-2">OpenRouter API Key</label>
                    <input 
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="sk-or-v1-..."
                      className="w-full bg-background/50 border border-border p-4 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all font-mono text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-foreground/60 uppercase tracking-widest mb-2">Preferred AI Model</label>
                    <select 
                      value={aiModel}
                      onChange={(e) => setAiModel(e.target.value)}
                      className="w-full bg-background/50 border border-border p-4 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all font-bold"
                    >
                      <option value="openai/gpt-3.5-turbo">GPT-3.5 Turbo (Standard)</option>
                      <option value="google/gemini-2.0-flash-001">Gemini 2.0 Flash (Fastest)</option>
                      <option value="openai/gpt-oss-20b:free">GPT OSS 20B (Free)</option>
                      <option value="openai/gpt-oss-120b:free">GPT OSS 120B (Free - Powerful)</option>
                      <option value="z-ai/glm-4.5-air:free">GLM 4.5 Air (Free - Detailed)</option>
                      <option value="meta-llama/llama-3-8b-instruct">Llama 3 8B (Reliable)</option>
                    </select>
                  </div>

                  <button 
                    onClick={() => setShowSettings(false)}
                    className="w-full py-4 bg-primary text-primary-foreground font-black rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-primary/20"
                  >
                    Save & Start Quiz
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-4xl mx-auto relative">
        <button 
          onClick={() => setShowSettings(true)}
          className="absolute right-0 top-0 p-3 rounded-2xl glass border border-primary/20 hover:border-primary/50 text-foreground transition-all group shadow-sm hover:shadow-primary/10"
          title="AI Settings"
        >
          <Settings className="w-6 h-6 group-hover:rotate-90 transition-transform duration-500" />
        </button>

        <header className="mb-12 text-center animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="inline-flex items-center justify-center p-3 mb-4 rounded-2xl bg-primary/10 text-primary">
            <BrainCircuit className="w-10 h-10" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl mb-4">
            Plaquiz <span className="text-primary tracking-normal font-black">AI</span>
          </h1>
          <p className="text-lg text-foreground/60 max-w-2xl mx-auto">
            Batch {currentPage + 1} of {Math.ceil(questions.length / questionsPerPage)}
          </p>
        </header>

        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="w-full max-w-md glass p-8 rounded-3xl border border-primary/30 shadow-2xl relative animate-in zoom-in-95 duration-300">
              <button 
                onClick={() => setShowSettings(false)}
                className="absolute right-4 top-4 p-2 hover:bg-primary/10 rounded-xl transition-colors"
              >
                <XCircle className="w-6 h-6 text-foreground/40" />
              </button>
              
              <div className="flex items-center gap-3 mb-6">
                <Settings className="w-6 h-6 text-primary" />
                <h2 className="text-2xl font-bold">AI Configuration</h2>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-foreground/60 uppercase tracking-widest mb-2">OpenRouter API Key</label>
                  <input 
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-or-v1-..."
                    className="w-full bg-background/50 border border-border p-4 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all font-mono text-sm"
                  />
                  <p className="mt-2 text-xs text-foreground/40 leading-relaxed italic">Your key is stored only in your browser and sent securely to your local backend.</p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-foreground/60 uppercase tracking-widest mb-2">Preferred AI Model</label>
                  <select 
                    value={aiModel}
                    onChange={(e) => setAiModel(e.target.value)}
                    className="w-full bg-background/50 border border-border p-4 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all font-bold"
                  >
                    <option value="openai/gpt-3.5-turbo">GPT-3.5 Turbo (Standard)</option>
                    <option value="google/gemini-2.0-flash-001">Gemini 2.0 Flash (Fastest)</option>
                    <option value="openai/gpt-oss-20b:free">GPT OSS 20B (Free)</option>
                    <option value="openai/gpt-oss-120b:free">GPT OSS 120B (Free - Powerful)</option>
                    <option value="z-ai/glm-4.5-air:free">GLM 4.5 Air (Free - Detailed)</option>
                    <option value="meta-llama/llama-3-8b-instruct">Llama 3 8B (Reliable)</option>
                  </select>
                </div>

                <button 
                  onClick={() => setShowSettings(false)}
                  className="w-full py-4 bg-primary text-primary-foreground font-black rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-primary/20"
                >
                  Save & Apply
                </button>
              </div>
            </div>
          </div>
        )}

        {isBatchSolving && (
          <div className="mb-8 p-6 rounded-2xl glass border border-primary/30 flex items-center justify-between animate-pulse">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-primary/20 rounded-lg">
                <Sparkles className="w-6 h-6 text-primary animate-bounce fill-primary/30" />
              </div>
              <div>
                <h4 className="font-bold text-foreground">AI is preparing your solutions...</h4>
                <p className="text-sm text-foreground/60">Solving the current 5 questions in the background.</p>
              </div>
            </div>
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        )}

        <div className="space-y-8">
          {currentQuestions.map((q) => (
            <QuestionCard 
              key={q.id}
              question={q}
              userAnswer={userAnswers[q.id]}
              onSelect={(opt) => handleSelect(q.id, opt)}
              onShowSolution={() => toggleSolution(q.id)}
              solution={solutions[q.id]?.show ? solutions[q.id] : null}
              isLoadingSolution={isBatchSolving && !solutions[q.id]}
              isResolved={!!solutions[q.id]}
            />
          ))}
        </div>

        <div className="mt-12 flex items-center justify-between pt-8 border-t border-border">
          <button
            onClick={handlePrevPage}
            disabled={currentPage === 0}
            className="px-6 py-2 rounded-xl bg-secondary text-foreground font-bold hover:bg-secondary/80 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            Previous
          </button>

          <div className="flex flex-col items-center">
             <div className="text-sm font-bold text-foreground/40 mb-1">
              SCORE: <span className="text-primary">{score}</span>
            </div>
            <div className="flex gap-1">
              {[...Array(Math.min(5, Math.ceil(questions.length / questionsPerPage)))].map((_, i) => (
                <div 
                  key={i} 
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${currentPage === i ? 'w-6 bg-primary' : 'bg-primary/20'}`} 
                />
              ))}
            </div>
          </div>

          <button
            onClick={handleNextPage}
            disabled={(currentPage + 1) * questionsPerPage >= questions.length}
            className="px-6 py-2 rounded-xl bg-primary text-primary-foreground font-bold hover:scale-105 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary/20"
          >
            Next Batch
          </button>
        </div>

        <footer className="mt-20 pt-8 border-t border-border text-center text-foreground/40 text-sm">
          &copy; 2026 Plaquiz AI &bull; Smart Quantitative Aptitude Learning
        </footer>
      </div>
    </div>
  );
}

export default App;
