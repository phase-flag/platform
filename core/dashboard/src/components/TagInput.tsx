import { useState } from 'react'
import { X } from 'lucide-react'

interface Props {
    tags: string[]
    onChange: (tags: string[]) => void
    placeholder?: string
}

export default function TagInput({ tags, onChange, placeholder = 'Add tag...' }: Props) {
    const [input, setInput] = useState('')

    function handleKeyDown(e: React.KeyboardEvent) {
        if (e.key === 'Enter' && input.trim()) {
            e.preventDefault()
            const newTag = input.trim().toLowerCase()
            if (!tags.includes(newTag)) {
                onChange([...tags, newTag])
            }
            setInput('')
        }
    }

    function removeTag(tag: string) {
        onChange(tags.filter(t => t !== tag))
    }

    return (
        <div>
            <div className="flex flex-wrap gap-2 mb-2">
                {tags.map(tag => (
                    <span
                        key={tag}
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
                    >
                        {tag}
                        <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            className="ml-1 hover:text-primary-500"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </span>
                ))}
            </div>
            <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 focus:border-primary-400 dark:bg-gray-800 dark:text-gray-100"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Press Enter to add a tag</p>
        </div>
    )
}
