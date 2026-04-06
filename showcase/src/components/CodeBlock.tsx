import { useState } from 'react'
import { ChevronDown, ChevronUp, Copy, Check, Code2 } from 'lucide-react'

interface CodeBlockProps {
    language: string
    code: string
    title?: string
}

export default function CodeBlock({ language, code, title }: CodeBlockProps) {
    const [open, setOpen] = useState(false)
    const [copied, setCopied] = useState(false)

    function handleCopy() {
        navigator.clipboard.writeText(code).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        })
    }

    return (
        <div className="mt-3 rounded-lg border border-gray-800 overflow-hidden">
            {/* Toggle button */}
            <button
                onClick={() => setOpen(v => !v)}
                className="w-full flex items-center justify-between px-3 py-2 bg-[#0B0F1A] hover:bg-gray-900 transition-colors text-left"
            >
                <div className="flex items-center space-x-2">
                    <Code2 className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-xs font-medium text-indigo-400">
                        {open ? 'Hide Code' : 'View Integration Code'}
                    </span>
                    {title && (
                        <span className="text-xs text-gray-600">— {title}</span>
                    )}
                </div>
                {open
                    ? <ChevronUp className="w-3.5 h-3.5 text-gray-500" />
                    : <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                }
            </button>

            {/* Code panel */}
            {open && (
                <div className="relative bg-[#0B0F1A] border-t border-gray-800">
                    {/* Language badge + Copy */}
                    <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-800/60">
                        <span className="text-[10px] font-mono text-gray-600 uppercase tracking-widest">{language}</span>
                        <button
                            onClick={handleCopy}
                            className="flex items-center space-x-1 text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
                        >
                            {copied
                                ? <><Check className="w-3 h-3 text-green-400" /><span className="text-green-400">Copied!</span></>
                                : <><Copy className="w-3 h-3" /><span>Copy</span></>
                            }
                        </button>
                    </div>

                    {/* Code */}
                    <pre className="overflow-x-auto px-4 py-3 text-xs font-mono leading-relaxed">
                        <code>{colorize(code, language)}</code>
                    </pre>
                </div>
            )}
        </div>
    )
}

// Lightweight syntax coloring — no external deps
function colorize(code: string, lang: string): React.ReactNode {
    if (lang !== 'typescript' && lang !== 'javascript') {
        return <span className="text-gray-300">{code}</span>
    }

    // Tokenize line by line for a readable result
    const lines = code.split('\n')
    return (
        <>
            {lines.map((line, i) => (
                <span key={i}>
                    {tokenizeLine(line)}
                    {i < lines.length - 1 && '\n'}
                </span>
            ))}
        </>
    )
}

type Token = { text: string; cls: string }

function tokenizeLine(line: string): React.ReactNode {
    const tokens: Token[] = []
    let rest = line

    while (rest.length > 0) {
        // Comment
        const commentMatch = rest.match(/^(\/\/.*)/)
        if (commentMatch) {
            tokens.push({ text: commentMatch[1], cls: 'text-gray-500 italic' })
            rest = rest.slice(commentMatch[1].length)
            continue
        }

        // String literal (single or double or template)
        const strMatch = rest.match(/^('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)/)
        if (strMatch) {
            tokens.push({ text: strMatch[1], cls: 'text-emerald-400' })
            rest = rest.slice(strMatch[1].length)
            continue
        }

        // Number
        const numMatch = rest.match(/^(\b\d+\b)/)
        if (numMatch) {
            tokens.push({ text: numMatch[1], cls: 'text-amber-300' })
            rest = rest.slice(numMatch[1].length)
            continue
        }

        // Keyword
        const kwMatch = rest.match(/^(const|let|var|function|async|await|return|import|export|from|default|new|if|else|true|false|null|undefined)\b/)
        if (kwMatch) {
            tokens.push({ text: kwMatch[1], cls: 'text-violet-400' })
            rest = rest.slice(kwMatch[1].length)
            continue
        }

        // Method call  foo(
        const methodMatch = rest.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)(\()/)
        if (methodMatch) {
            tokens.push({ text: methodMatch[1], cls: 'text-sky-300' })
            tokens.push({ text: methodMatch[2], cls: 'text-gray-300' })
            rest = rest.slice(methodMatch[0].length)
            continue
        }

        // Identifier
        const identMatch = rest.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)/)
        if (identMatch) {
            tokens.push({ text: identMatch[1], cls: 'text-gray-200' })
            rest = rest.slice(identMatch[1].length)
            continue
        }

        // Punctuation / operator
        const punctMatch = rest.match(/^([{}[\]().,;:=+\-*/<>!&|?@#%^~`\\])/)
        if (punctMatch) {
            tokens.push({ text: punctMatch[1], cls: 'text-gray-400' })
            rest = rest.slice(punctMatch[1].length)
            continue
        }

        // Whitespace / anything else
        tokens.push({ text: rest[0], cls: 'text-gray-300' })
        rest = rest.slice(1)
    }

    return (
        <>
            {tokens.map((t, i) => (
                <span key={i} className={t.cls}>{t.text}</span>
            ))}
        </>
    )
}
