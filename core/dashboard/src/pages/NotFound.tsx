import { Link } from 'react-router-dom'
import { Home, ArrowLeft } from 'lucide-react'

export default function NotFound() {
    return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
                <h1 className="text-8xl font-bold text-gray-200 dark:text-gray-700">404</h1>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mt-4">Page Not Found</h2>
                <p className="text-gray-600 dark:text-gray-400 mt-2 max-w-md mx-auto">
                    The page you're looking for doesn't exist or has been moved.
                </p>
                <div className="flex items-center justify-center space-x-4 mt-8">
                    <button
                        onClick={() => window.history.back()}
                        className="btn btn-secondary flex items-center space-x-2"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Go Back</span>
                    </button>
                    <Link to="/dashboard" className="btn btn-primary flex items-center space-x-2">
                        <Home className="w-4 h-4" />
                        <span>Dashboard</span>
                    </Link>
                </div>
            </div>
        </div>
    )
}
