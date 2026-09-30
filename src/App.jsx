import { Routes, Route } from 'react-router-dom'
import Shelf from './pages/Shelf.jsx'
import Import from './pages/Import.jsx'
import Book from './pages/Book.jsx'
import Quiz from './pages/Quiz.jsx'
import QuizSet from './pages/QuizSet.jsx'
import Saved from './pages/Saved.jsx'
import SavedDetail from './pages/SavedDetail.jsx'
import Settings from './pages/Settings.jsx'

export default function App() {
  return (
    <div className="mx-auto max-w-2xl px-5 pb-24">
      <Routes>
        <Route path="/" element={<Shelf />} />
        <Route path="/import" element={<Import />} />
        <Route path="/book/:id" element={<Book />} />
        <Route path="/quiz/:chapterId" element={<Quiz />} />
        <Route path="/set/:bookId" element={<QuizSet />} />
        <Route path="/saved/:bookId" element={<Saved />} />
        <Route path="/q/:questionId" element={<SavedDetail />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </div>
  )
}
