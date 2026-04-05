import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { segmentsApi, type Segment, type Condition } from '@/lib/api'
import { X, Plus, Trash2 } from 'lucide-react'

const OPERATORS = [
    'is', 'is_not', 'contains', 'not_contains',
    'one_of', 'not_one_of', 'gt', 'lt',
    'matches_regex', 'version_gt', 'version_lt',
] as const

interface ConditionInput {
    attribute: string
    operator: string
    value: string
}

interface Props {
    isOpen: boolean
    onClose: () => void
    segment?: Segment // if provided, we're editing
}

export default function SegmentModal({ isOpen, onClose, segment }: Props) {
    const queryClient = useQueryClient()

    const [key, setKey] = useState('')
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [conditions, setConditions] = useState<ConditionInput[]>([])
    const [errors, setErrors] = useState<Record<string, string>>({})

    const isEditing = !!segment

    useEffect(() => {
        if (segment) {
            setKey(segment.key)
            setName(segment.name)
            setDescription(segment.description || '')
            setConditions(
                segment.conditions.map(c => ({
                    attribute: c.attribute,
                    operator: c.operator,
                    value: JSON.stringify(c.value ?? c.values ?? ''),
                }))
            )
        } else {
            setKey('')
            setName('')
            setDescription('')
            setConditions([])
        }
        setErrors({})
    }, [segment, isOpen])

    const createMutation = useMutation({
        mutationFn: (data: Parameters<typeof segmentsApi.create>[0]) => segmentsApi.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['segments'] })
            onClose()
        },
    })

    const updateMutation = useMutation({
        mutationFn: (data: Parameters<typeof segmentsApi.update>[1]) => segmentsApi.update(segment!.key, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['segments'] })
            queryClient.invalidateQueries({ queryKey: ['segment', segment!.key] })
            onClose()
        },
    })

    const mutation = isEditing ? updateMutation : createMutation

    function validate(): boolean {
        const newErrors: Record<string, string> = {}
        if (!isEditing) {
            if (!key.trim()) newErrors.key = 'Key is required'
            else if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(key)) newErrors.key = 'Key must be kebab-case'
        }
        if (!name.trim()) newErrors.name = 'Name is required'
        if (conditions.some(c => !c.attribute.trim())) newErrors.conditions = 'All conditions need an attribute'
        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    function parseConditions(): Condition[] {
        return conditions.map(c => {
            const op = c.operator
            let value: unknown = c.value
            // Try JSON parse for arrays and objects
            try { value = JSON.parse(c.value) } catch { /* keep as string */ }

            if (op === 'one_of' || op === 'not_one_of') {
                const values = Array.isArray(value) ? value : [value]
                return { attribute: c.attribute, operator: op, values }
            }
            return { attribute: c.attribute, operator: op, value }
        })
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!validate()) return

        const parsed = parseConditions()

        if (isEditing) {
            updateMutation.mutate({ name, description, conditions: parsed })
        } else {
            createMutation.mutate({ key, name, description, conditions: parsed })
        }
    }

    function addCondition() {
        setConditions([...conditions, { attribute: '', operator: 'is', value: '' }])
    }

    function removeCondition(index: number) {
        setConditions(conditions.filter((_, i) => i !== index))
    }

    function updateCondition(index: number, field: keyof ConditionInput, value: string) {
        const updated = [...conditions]
        updated[index] = { ...updated[index], [field]: value }
        setConditions(updated)
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                        {isEditing ? 'Edit Segment' : 'Create Segment'}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-700 rounded-lg">
                        <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Key */}
                    {!isEditing ? (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Key</label>
                            <input
                                type="text"
                                value={key}
                                onChange={(e) => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                                placeholder="my-segment"
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                            />
                            {errors.key && <p className="mt-1 text-sm text-red-600">{errors.key}</p>}
                        </div>
                    ) : (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Key</label>
                            <p className="font-mono text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-700/50 px-3 py-2 rounded-lg">{key}</p>
                        </div>
                    )}

                    {/* Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="My Segment"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        />
                        {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="What does this segment target?"
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        />
                    </div>

                    {/* Conditions */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Conditions</label>
                            <button type="button" onClick={addCondition} className="text-sm text-primary-600 hover:text-primary-700 flex items-center">
                                <Plus className="w-4 h-4 mr-1" /> Add Condition
                            </button>
                        </div>
                        {conditions.length === 0 && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                                No conditions yet. Add one to define your segment.
                            </p>
                        )}
                        <div className="space-y-3">
                            {conditions.map((c, i) => (
                                <div key={i} className="flex items-start space-x-2">
                                    <input
                                        type="text"
                                        value={c.attribute}
                                        onChange={(e) => updateCondition(i, 'attribute', e.target.value)}
                                        placeholder="Attribute"
                                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 focus:border-primary-400 focus:outline-none"
                                    />
                                    <select
                                        value={c.operator}
                                        onChange={(e) => updateCondition(i, 'operator', e.target.value)}
                                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 focus:border-primary-400 focus:outline-none"
                                    >
                                        {OPERATORS.map(op => (
                                            <option key={op} value={op}>{op}</option>
                                        ))}
                                    </select>
                                    <input
                                        type="text"
                                        value={c.value}
                                        onChange={(e) => updateCondition(i, 'value', e.target.value)}
                                        placeholder="Value"
                                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 focus:border-primary-400 focus:outline-none"
                                    />
                                    <button type="button" onClick={() => removeCondition(i)} className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-500">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                        {errors.conditions && <p className="mt-1 text-sm text-red-600">{errors.conditions}</p>}
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
                            {mutation.isPending ? (isEditing ? 'Saving...' : 'Creating...') : (isEditing ? 'Save Changes' : 'Create Segment')}
                        </button>
                    </div>

                    {mutation.isError && (
                        <p className="text-sm text-red-600">
                            Failed: {(mutation.error as Error)?.message || 'Unknown error'}
                        </p>
                    )}
                </form>
            </div>
        </div>
    )
}
