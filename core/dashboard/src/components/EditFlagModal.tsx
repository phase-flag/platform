import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { flagsApi, type FeatureFlag } from '@/lib/api'
import { X, Plus, Trash2 } from 'lucide-react'
import TagInput from '@/components/TagInput'

interface VariationInput {
    key: string
    value: string
}

interface Props {
    flag: FeatureFlag
    isOpen: boolean
    onClose: () => void
}

const ENVIRONMENTS = ['development', 'staging', 'production'] as const

export default function EditFlagModal({ flag, isOpen, onClose }: Props) {
    const queryClient = useQueryClient()

    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [environment, setEnvironment] = useState('')
    const [variations, setVariations] = useState<VariationInput[]>([])
    const [defaultVariationKey, setDefaultVariationKey] = useState('')
    const [tags, setTags] = useState<string[]>([])

    useEffect(() => {
        if (flag && isOpen) {
            setName(flag.name)
            setDescription(flag.description || '')
            setEnvironment(flag.environment)
            setVariations(flag.variations.map(v => ({
                key: v.key,
                value: JSON.stringify(v.value),
            })))
            const defaultVar = flag.variations.find(v => v.id === flag.default_variation_id)
            setDefaultVariationKey(defaultVar?.key || flag.variations[0]?.key || '')
            setTags(flag.tags || [])
        }
    }, [flag, isOpen])

    const mutation = useMutation({
        mutationFn: (data: Parameters<typeof flagsApi.update>[1]) => flagsApi.update(flag.key, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['flag', flag.key] })
            queryClient.invalidateQueries({ queryKey: ['flags'] })
            onClose()
        },
    })

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault()

        const parsedVariations = variations.map(v => {
            let value: unknown = v.value
            if (flag.flag_type === 'boolean') value = v.value === 'true'
            else if (flag.flag_type === 'number') value = Number(v.value)
            else if (flag.flag_type === 'json') {
                try { value = JSON.parse(v.value) } catch { value = v.value }
            }
            return { key: v.key, name: v.key, value }
        })

        mutation.mutate({
            name,
            description,
            environment,
            variations: parsedVariations,
            default_variation_key: defaultVariationKey,
            tags,
        })
    }

    function addVariation() {
        setVariations([...variations, { key: '', value: '' }])
    }

    function removeVariation(index: number) {
        const updated = variations.filter((_, i) => i !== index)
        setVariations(updated)
    }

    function updateVariation(index: number, field: keyof VariationInput, value: string) {
        const updated = [...variations]
        updated[index] = { ...updated[index], [field]: value }
        setVariations(updated)
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Edit Flag</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-700 rounded-lg">
                        <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Key (read-only) */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Key</label>
                        <input
                            type="text"
                            value={flag.key}
                            disabled
                            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                        />
                    </div>

                    {/* Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-900 dark:text-gray-100"
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-900 dark:text-gray-100"
                        />
                    </div>

                    {/* Environment */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Environment</label>
                        <select
                            value={environment}
                            onChange={(e) => setEnvironment(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-900 dark:text-gray-100"
                        >
                            {ENVIRONMENTS.map(e => (
                                <option key={e} value={e}>{e.charAt(0).toUpperCase() + e.slice(1)}</option>
                            ))}
                        </select>
                    </div>

                    {/* Variations */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Variations</label>
                            <button type="button" onClick={addVariation} className="text-sm text-primary-600 hover:text-primary-700 flex items-center">
                                <Plus className="w-4 h-4 mr-1" /> Add Variation
                            </button>
                        </div>
                        <div className="space-y-2">
                            {variations.map((v, i) => (
                                <div key={i} className="flex items-center space-x-2">
                                    <input
                                        type="radio"
                                        name="defaultVariation"
                                        checked={defaultVariationKey === v.key}
                                        onChange={() => setDefaultVariationKey(v.key)}
                                        className="mt-0.5"
                                    />
                                    <input
                                        type="text"
                                        value={v.key}
                                        onChange={(e) => updateVariation(i, 'key', e.target.value)}
                                        placeholder="Key"
                                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-900 dark:text-gray-100"
                                    />
                                    <input
                                        type="text"
                                        value={v.value}
                                        onChange={(e) => updateVariation(i, 'value', e.target.value)}
                                        placeholder="Value"
                                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-900 dark:text-gray-100"
                                    />
                                    {variations.length > 2 && (
                                        <button type="button" onClick={() => removeVariation(i)} className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-500">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Radio button selects the default variation</p>
                    </div>

                    {/* Tags */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tags</label>
                        <TagInput tags={tags} onChange={setTags} />
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={mutation.isPending}
                            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
                        >
                            {mutation.isPending ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>

                    {mutation.isError && (
                        <p className="text-sm text-red-600">
                            Failed to update flag: {(mutation.error as Error)?.message || 'Unknown error'}
                        </p>
                    )}
                </form>
            </div>
        </div>
    )
}
