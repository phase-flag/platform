import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { flagsApi } from '@/lib/api'
import { Plus, Trash2 } from 'lucide-react'
import TagInput from '@/components/TagInput'
import Modal from '@/components/Modal'

interface VariationInput {
    key: string
    value: string
}

interface Props {
    isOpen: boolean
    onClose: () => void
}

const FLAG_TYPES = ['boolean', 'string', 'number', 'json'] as const
const ENVIRONMENTS = ['development', 'staging', 'production'] as const

export default function CreateFlagModal({ isOpen, onClose }: Props) {
    const queryClient = useQueryClient()

    const [key, setKey] = useState('')
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [flagType, setFlagType] = useState<string>('boolean')
    const [environment, setEnvironment] = useState<string>('development')
    const [variations, setVariations] = useState<VariationInput[]>([
        { key: 'on', value: 'true' },
        { key: 'off', value: 'false' },
    ])
    const [defaultVariationKey, setDefaultVariationKey] = useState('off')
    const [tags, setTags] = useState<string[]>([])
    const [errors, setErrors] = useState<Record<string, string>>({})

    const mutation = useMutation({
        mutationFn: (data: Parameters<typeof flagsApi.create>[0]) => flagsApi.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['flags'] })
            resetForm()
            onClose()
        },
    })

    function resetForm() {
        setKey('')
        setName('')
        setDescription('')
        setFlagType('boolean')
        setEnvironment('development')
        setVariations([
            { key: 'on', value: 'true' },
            { key: 'off', value: 'false' },
        ])
        setDefaultVariationKey('off')
        setTags([])
        setErrors({})
    }

    function validate(): boolean {
        const newErrors: Record<string, string> = {}
        if (!key.trim()) newErrors.key = 'Key is required'
        else if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(key)) newErrors.key = 'Key must be kebab-case (e.g., my-flag)'
        if (!name.trim()) newErrors.name = 'Name is required'
        if (variations.length < 2) newErrors.variations = 'At least 2 variations required'
        if (variations.some(v => !v.key.trim())) newErrors.variations = 'All variation keys are required'
        if (!defaultVariationKey) newErrors.default = 'Default variation is required'
        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!validate()) return

        const parsedVariations = variations.map(v => {
            let value: unknown = v.value
            if (flagType === 'boolean') value = v.value === 'true'
            else if (flagType === 'number') value = Number(v.value)
            else if (flagType === 'json') {
                try { value = JSON.parse(v.value) } catch { value = v.value }
            }
            return { key: v.key, name: v.key, value }
        })

        mutation.mutate({
            key,
            name,
            description,
            flag_type: flagType,
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
        if (variations[index].key === defaultVariationKey && updated.length > 0) {
            setDefaultVariationKey(updated[0].key)
        }
    }

    function updateVariation(index: number, field: keyof VariationInput, value: string) {
        const updated = [...variations]
        updated[index] = { ...updated[index], [field]: value }
        setVariations(updated)
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Create Feature Flag" size="lg">
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Key</label>
                    <input
                        type="text"
                        value={key}
                        onChange={(e) => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                        placeholder="my-feature-flag"
                        title="Unique identifier used in SDK code (e.g., 'new-checkout'). Cannot be changed after creation."
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-primary-400 dark:bg-gray-900 dark:text-gray-100"
                    />
                    {errors.key && <p className="mt-1 text-sm text-red-600">{errors.key}</p>}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="My Feature Flag"
                        title="Human-readable name displayed in the dashboard"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-primary-400 dark:bg-gray-900 dark:text-gray-100"
                    />
                    {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="What does this flag control?"
                        rows={2}
                        title="Describe what this flag controls and when it should be used"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-primary-400 dark:bg-gray-900 dark:text-gray-100"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                        <select
                            value={flagType}
                            onChange={(e) => setFlagType(e.target.value)}
                            title="boolean = on/off, string = text variants, number = numeric values, json = structured data"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-primary-400 dark:bg-gray-900 dark:text-gray-100"
                        >
                            {FLAG_TYPES.map(t => (
                                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Environment</label>
                        <select
                            value={environment}
                            onChange={(e) => setEnvironment(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-primary-400 dark:bg-gray-900 dark:text-gray-100"
                        >
                            {ENVIRONMENTS.map(e => (
                                <option key={e} value={e}>{e.charAt(0).toUpperCase() + e.slice(1)}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Variations</label>
                        <button type="button" onClick={addVariation} className="text-sm text-primary-500 hover:text-primary-600 flex items-center">
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
                                    title="The variation returned when no targeting rules match"
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
                                    <button type="button" onClick={() => removeVariation(i)} className="p-1 text-gray-400 hover:text-red-500">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                    {errors.variations && <p className="mt-1 text-sm text-red-600">{errors.variations}</p>}
                    {errors.default && <p className="mt-1 text-sm text-red-600">{errors.default}</p>}
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Radio button selects the default variation</p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tags</label>
                    <TagInput tags={tags} onChange={setTags} />
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={mutation.isPending}
                        className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
                    >
                        {mutation.isPending ? 'Creating...' : 'Create Flag'}
                    </button>
                </div>

                {mutation.isError && (
                    <p className="text-sm text-red-600">
                        Failed to create flag: {(mutation.error as Error)?.message || 'Unknown error'}
                    </p>
                )}
            </form>
        </Modal>
    )
}
