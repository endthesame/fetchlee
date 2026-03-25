import fs from 'fs';
import { Interaction, InteractionGroups, TaskConfig } from './interfaces/task';

interface LegacyActionRule {
    url_pattern: string;
    actions: string[];
}

interface RawTaskConfig extends Partial<TaskConfig> {
    actions_before_extraction?: LegacyActionRule[];
    actions_after_extraction?: LegacyActionRule[];
}

function toInteractionRules(rules: LegacyActionRule[]): Interaction[] {
    return rules.map((legacyRule) => ({
        url_pattern: legacyRule.url_pattern,
        rules: [
            {
                name: 'legacy-actions',
                actions: (Array.isArray(legacyRule.actions) ? legacyRule.actions : []).map((action) => ({
                    type: 'evaluate',
                    value: action
                }))
            }
        ]
    }));
}

function normalizeInteractions(rawTask: RawTaskConfig): InteractionGroups {
    const interactions: InteractionGroups = {
        pre: rawTask.interactions?.pre ? [...rawTask.interactions.pre] : [],
        post: rawTask.interactions?.post ? [...rawTask.interactions.post] : []
    };

    if (rawTask.interaction_rules && rawTask.interaction_rules.length > 0) {
        interactions.pre?.push(...rawTask.interaction_rules);
    }

    if (rawTask.actions_before_extraction && rawTask.actions_before_extraction.length > 0) {
        interactions.pre?.push(...toInteractionRules(rawTask.actions_before_extraction));
    }

    if (rawTask.actions_after_extraction && rawTask.actions_after_extraction.length > 0) {
        interactions.post?.push(...toInteractionRules(rawTask.actions_after_extraction));
    }

    return interactions;
}

function validateTaskConfig(task: TaskConfig): string[] {
    const errors: string[] = [];

    if (!Array.isArray(task.crawl_rules)) {
        errors.push('`crawl_rules` must be an array.');
    } else {
        task.crawl_rules.forEach((rule, index) => {
            if (!rule || typeof rule.from !== 'string' || !rule.from.trim()) {
                errors.push(`crawl_rules[${index}].from must be a non-empty string.`);
            }
            if (rule.to && !Array.isArray(rule.to)) {
                errors.push(`crawl_rules[${index}].to must be an array when provided.`);
            }
        });
    }

    if (!Array.isArray(task.metadata_extraction)) {
        errors.push('`metadata_extraction` must be an array.');
    } else {
        task.metadata_extraction.forEach((rule, index) => {
            if (!rule || typeof rule.url_pattern !== 'string' || !rule.url_pattern.trim()) {
                errors.push(`metadata_extraction[${index}].url_pattern must be a non-empty string.`);
            }
            if (!rule.fields || typeof rule.fields !== 'object') {
                errors.push(`metadata_extraction[${index}].fields must be an object.`);
            }
        });
    }

    const allInteractions = [
        ...(task.interactions?.pre || []),
        ...(task.interactions?.post || [])
    ];

    allInteractions.forEach((group, groupIndex) => {
        if (!group || typeof group.url_pattern !== 'string' || !group.url_pattern.trim()) {
            errors.push(`interaction group [${groupIndex}] must have non-empty url_pattern.`);
        }
        if (!Array.isArray(group.rules)) {
            errors.push(`interaction group [${groupIndex}].rules must be an array.`);
            return;
        }
        group.rules.forEach((rule, ruleIndex) => {
            if (!Array.isArray(rule.actions) || rule.actions.length === 0) {
                errors.push(`interaction group [${groupIndex}].rules[${ruleIndex}].actions must be a non-empty array.`);
            }
        });
    });

    return errors;
}

export function loadTaskConfig(taskPath: string): TaskConfig {
    let rawTask: RawTaskConfig;
    try {
        const taskData = fs.readFileSync(taskPath, 'utf-8');
        rawTask = JSON.parse(taskData) as RawTaskConfig;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown parsing error';
        throw new Error(`Failed to read or parse task file "${taskPath}": ${errorMessage}`);
    }

    const normalizedTask: TaskConfig = {
        crawl_rules: rawTask.crawl_rules || [],
        metadata_extraction: rawTask.metadata_extraction || [],
        links_transformation: rawTask.links_transformation || [],
        interactions: normalizeInteractions(rawTask),
        interaction_rules: rawTask.interaction_rules
    };

    const validationErrors = validateTaskConfig(normalizedTask);
    if (validationErrors.length > 0) {
        throw new Error(`Task config validation failed:\n- ${validationErrors.join('\n- ')}`);
    }

    return normalizedTask;
}
