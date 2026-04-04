import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { flagsApi, type FeatureFlag, type TargetingRule, type Condition } from '@/lib/api'
import { Plus, Trash2, ChevronDown, ChevronRight, GripVertical } from 'lucide-react'

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

interface RuleInput {
    description: string
    priority: number
    conditions: ConditionInput[]
    variation_id: string
    usePercentage: boolean
    percentageWeights: Array<{ variation_id: string; weight: number }>
}

interface Props {
    flag: FeatureFlag
}

function newRule(flag: FeatureFlag): RuleInput {
    return {
        description: '',
        priority: flag.targeting_rules.length + 1,
        conditions: [{ attribute: '', operator: 'is', value: '' }],
        variation_id: flag.variations[0]?.id || '',
        usePercentage: false,
        percentageWeights: flag.variations.map(v => ({ variation_id: v.id, weight: 0 })),
    }
}

function ruleToInput(rule: TargetingRule, flag: FeatureFlag): RuleInput {
    const hasPercentage = !!rule.percentage_rollout && rule.percentage_rollout.variations.length > 0
    return {
        description: rule.description,
        priority: rule.priority,
        conditions: rule.conditions.map(c => ({
            attribute: c.attribute,
            operator: c.operator,
            value: JSON.stringify(c.value ?? c.values ?? ''),
        })),
        variation_id: rule.variation_id || flag.variations[0]?.id || '',
        usePercentage: hasPercentage,
        percentageWeights: hasPercentage
            ? flag.variations.map(v => {
                const existing = rule.percentage_rollout!.variations.find(pv => pv.variation_id === v.id)
                return { variation_id: v.id, weight: existing?.weight ?? 0 }
            })
            : flag.variations.map(v => ({ variation_id: v.id, weight: 0 })),
    }
}

function inputToRule(input: RuleInput): Record<string, unknown> {
    const conditions: Condition[] = input.conditions.map(c => {
        let value: unknown = c.value
        try { value = JSON.parse(c.value) } catch { /* keep string */ }
        if (c.operator === 'one_of' || c.operator === 'not_one_of') {
            return { attribute: c.attribute, operator: c.operator, values: Array.isArray(value) ? value : [value] }
        }
        return { attribute: c.attribute, operator: c.operator, value }
    })

    const rule: Record<string, unknown> = {
        description: input.description,
        priority: input.priority,
        conditions,
    }

    if (input.usePercentage) {
        rule.percentage_rollout = {
            variations: input.percentageWeights.filter(w => w.weight > 0),
        }
    } else {
        rule.variation_id = input.variation_id
    }

    return rule
}

export default function TargetingRuleBuilder({ flag }: Props) {
    const queryClient = useQueryClient()
    const [editingIndex, setEditingIndex] = useState<number | null>(null)
    const [isAdding, setIsAdding] = useState(false)
    const [ruleInput, setRuleInput] = useState<RuleInput>(newRule(flag))

    const mutation = useMutation({
        mutationFn: (rules: Record<string, unknown>[]) =>
            flagsApi.update(flag.key, { targeting_rules: rules as unknown as TargetingRule[] }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['flag', flag.key] })
            queryClient.invalidateQueries({ queryKey: ['flags'] })
            setEditingIndex(null)
            setIsAdding(false)
        },
    })

    function handleAddRule() {
        setRuleInput(newRule(flag))
        setIsAdding(true)
        setEditingIndex(null)
    }

    function handleEditRule(idx: number) {
        setRuleInput(ruleToInput(flag.targeting_rules[idx], flag))
        setEditingIndex(idx)
        setIsAdding(false)
    }

    function handleDeleteRule(idx: number) {
        const updated = flag.targeting_rules
            .filter((_, i) => i !== idx)
            .map((r, i) => ({ ...inputToRule(ruleToInput(r, flag)), priority: i + 1 }))
        mutation.mutate(updated)
    }

    function handleSave() {
        const existingRules = flag.targeting_rules.map((r) => inputToRule(ruleToInput(r, flag)))
        if (isAdding) {
            existingRules.push(inputToRule(ruleInput))
        } else if (editingIndex !== null) {
            existingRules[editingIndex] = inputToRule(ruleInput)
        }
        mutation.mutate(existingRules)
    }

    function handleCancel() {
        setIsAdding(false)
        setEditingIndex(null)
    }

    function addCondition() {
        setRuleInput(prev => ({
            ...prev,
            conditions: [...prev.conditions, { attribute: '', operator: 'is', value: '' }],
        }))
    }

    function removeCondition(idx: number) {
        setRuleInput(prev => ({
            ...prev,
            conditions: prev.conditions.filter((_, i) => i !== idx),
        }))
    }

    function updateCondition(idx: number, field: keyof ConditionInput, value: string) {
        setRuleInput(prev => {
            const conditions = [...prev.conditions]
            conditions[idx] = { ...conditions[idx], [field]: value }
            return { ...prev, conditions }
        })
    }

    function updateWeight(variationId: string, weight: number) {
        setRuleInput(prev => ({
            ...prev,
            percentageWeights: prev.percentageWeights.map(w =>
                w.variation_id === variationId ? { ...w, weight } : w
            ),
        }))
    }

    const totalWeight = ruleInput.percentageWeights.reduce((sum, w) => sum + w.weight, 0)
    const isFormOpen = isAdding || editingIndex !== null

    return (
        <div className="card">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Targeting Rules</h2>
                {!isFormOpen && (
                    <button onClick={handleAddRule} className="text-sm text-primary-600 hover:text-primary-700 flex items-center">
                        <Plus className="w-4 h-4 mr-1" /> Add Rule
                    </button>
                )}
            </div>

            {/* Existing rules */}
            {flag.targeting_rules.length > 0 && (
                <div className="space-y-3 mb-4">
                    {flag.targeting_rules.map((rule, idx) => (
                        <div key={rule.id || idx} className="border border-gray-200 dark:border-gray-700 rounded-lg">
                            <div
                                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-700/50"
                                onClick={() => editingIndex === idx ? handleCancel() : handleEditRule(idx)}
                            >
                                <div className="flex items-center space-x-3">
                                    <GripVertical className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                                    {editingIndex === idx ? (
                                        <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                                    ) : (
                                        <ChevronRight className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                                    )}
                                    <div>
                                        <p className="font-medium text-gray-900 dark:text-gray-100">{rule.description || `Rule ${idx + 1}`}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">{rule.conditions.length} condition{rule.conditions.length !== 1 ? 's' : ''}</p>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <span className="badge badge-info">Priority {rule.priority}</span>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDeleteRule(idx) }}
                                        className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-500"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {editingIndex === idx && (
                                <div className="border-t border-gray-200 dark:border-gray-700 p-4">
                                    <RuleForm
                                        ruleInput={ruleInput}
                                        setRuleInput={setRuleInput}
                                        flag={flag}
                                        addCondition={addCondition}
                                        removeCondition={removeCondition}
                                        updateCondition={updateCondition}
                                        updateWeight={updateWeight}
                                        totalWeight={totalWeight}
                                    />
                                    <div className="flex justify-end space-x-2 mt-4">
                                        <button onClick={handleCancel} className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-700/50">
                                            Cancel
                                        </button>
                                        <button onClick={handleSave} disabled={mutation.isPending} className="px-3 py-1.5 text-sm text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50">
                                            {mutation.isPending ? 'Saving...' : 'Save'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {flag.targeting_rules.length === 0 && !isAdding && (
                <p className="text-gray-500 dark:text-gray-400 mb-4">No targeting rules configured</p>
            )}

            {/* Add new rule form */}
            {isAdding && (
                <div className="border border-primary-200 bg-primary-50/30 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">New Rule</h3>
                    <RuleForm
                        ruleInput={ruleInput}
                        setRuleInput={setRuleInput}
                        flag={flag}
                        addCondition={addCondition}
                        removeCondition={removeCondition}
                        updateCondition={updateCondition}
                        updateWeight={updateWeight}
                        totalWeight={totalWeight}
                    />
                    <div className="flex justify-end space-x-2 mt-4">
                        <button onClick={handleCancel} className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-700/50">
                            Cancel
                        </button>
                        <button onClick={handleSave} disabled={mutation.isPending} className="px-3 py-1.5 text-sm text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50">
                            {mutation.isPending ? 'Adding...' : 'Add Rule'}
                        </button>
                    </div>
                </div>
            )}

            {mutation.isError && (
                <p className="mt-2 text-sm text-red-600">
                    Failed to save rules: {(mutation.error as Error)?.message || 'Unknown error'}
                </p>
            )}
        </div>
    )
}

interface RuleFormProps {
    ruleInput: RuleInput
    setRuleInput: React.Dispatch<React.SetStateAction<RuleInput>>
    flag: FeatureFlag
    addCondition: () => void
    removeCondition: (idx: number) => void
    updateCondition: (idx: number, field: keyof ConditionInput, value: string) => void
    updateWeight: (variationId: string, weight: number) => void
    totalWeight: number
}

function RuleForm({
    ruleInput, setRuleInput, flag,
    addCondition, removeCondition, updateCondition,
    updateWeight, totalWeight,
}: RuleFormProps) {
    return (
        <div className="space-y-4">
            {/* Description + Priority */}
            <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Description</label>
                    <input
                        type="text"
                        value={ruleInput.description}
                        onChange={(e) => setRuleInput(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Rule description"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Priority</label>
                    <input
                        type="number"
                        value={ruleInput.priority}
                        onChange={(e) => setRuleInput(prev => ({ ...prev, priority: parseInt(e.target.value) || 1 }))}
                        min={1}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                    />
                </div>
            </div>

            {/* Conditions */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Conditions</label>
                    <button type="button" onClick={addCondition} className="text-xs text-primary-600 hover:text-primary-700 flex items-center">
                        <Plus className="w-3 h-3 mr-1" /> Add
                    </button>
                </div>
                <div className="space-y-2">
                    {ruleInput.conditions.map((c, i) => (
                        <div key={i} className="flex items-center space-x-2">
                            <input
                                type="text"
                                value={c.attribute}
                                onChange={(e) => updateCondition(i, 'attribute', e.target.value)}
                                placeholder="Attribute"
                                className="flex-1 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm"
                            />
                            <select
                                value={c.operator}
                                onChange={(e) => updateCondition(i, 'operator', e.target.value)}
                                className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm"
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
                                className="flex-1 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm"
                            />
                            {ruleInput.conditions.length > 1 && (
                                <button type="button" onClick={() => removeCondition(i)} className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-500">
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Serve variation or percentage */}
            <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2 block">Serve</label>
                <div className="flex items-center space-x-4 mb-3">
                    <label className="flex items-center space-x-2 text-sm">
                        <input
                            type="radio"
                            checked={!ruleInput.usePercentage}
                            onChange={() => setRuleInput(prev => ({ ...prev, usePercentage: false }))}
                        />
                        <span>Specific variation</span>
                    </label>
                    <label className="flex items-center space-x-2 text-sm">
                        <input
                            type="radio"
                            checked={ruleInput.usePercentage}
                            onChange={() => setRuleInput(prev => ({ ...prev, usePercentage: true }))}
                        />
                        <span>Percentage rollout</span>
                    </label>
                </div>

                {!ruleInput.usePercentage ? (
                    <select
                        value={ruleInput.variation_id}
                        onChange={(e) => setRuleInput(prev => ({ ...prev, variation_id: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                    >
                        {flag.variations.map(v => (
                            <option key={v.id} value={v.id}>{v.name} ({v.key})</option>
                        ))}
                    </select>
                ) : (
                    <div className="space-y-2">
                        {flag.variations.map(v => {
                            const pw = ruleInput.percentageWeights.find(w => w.variation_id === v.id)
                            return (
                                <div key={v.id} className="flex items-center space-x-3">
                                    <span className="text-sm text-gray-700 dark:text-gray-300 w-32 truncate">{v.name}</span>
                                    <input
                                        type="range"
                                        min={0}
                                        max={100}
                                        value={pw?.weight ?? 0}
                                        onChange={(e) => updateWeight(v.id, parseInt(e.target.value))}
                                        className="flex-1"
                                    />
                                    <span className="text-sm font-mono w-12 text-right">{pw?.weight ?? 0}%</span>
                                </div>
                            )
                        })}
                        <p className={`text-xs ${totalWeight === 100 ? 'text-success-600' : 'text-red-600'}`}>
                            Total: {totalWeight}% {totalWeight !== 100 && '(must equal 100%)'}
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}
