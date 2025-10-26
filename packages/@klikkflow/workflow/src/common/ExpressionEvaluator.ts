// Expression evaluator reusing patterns from workflow-engine
// biome-ignore lint/suspicious/noExplicitAny: Pre-existing utility accepts generic expression context
export class ExpressionEvaluator {
  private context: Record<string, any>;

  // biome-ignore lint/suspicious/noExplicitAny: Pre-existing utility accepts generic expression context
  constructor(context: Record<string, any> = {}) {
    this.context = context;
  }

  // biome-ignore lint/suspicious/noExplicitAny: Pre-existing utility returns dynamic expression results
  evaluate(expression: string): any {
    if (!expression || typeof expression !== 'string') {
      return expression;
    }

    // Simple expression evaluation - placeholder implementation
    try {
      // Handle basic template literals
      if (expression.includes('{{') && expression.includes('}}')) {
        return this.evaluateTemplate(expression);
      }

      // Handle simple property access
      if (expression.startsWith('$')) {
        return this.evaluateProperty(expression);
      }

      return expression;
    } catch (_error) {
      return expression;
    }
  }

  // biome-ignore lint/suspicious/noExplicitAny: Pre-existing utility returns dynamic template results
  private evaluateTemplate(expression: string): any {
    // Replace {{variable}} with context values
    // CodeQL fix: Use negated character class to prevent ReDoS (Alert #119)
    return expression.replace(/\{\{([^}]+)\}\}/g, (match, variable) => {
      const trimmed = variable.trim();
      return this.getContextValue(trimmed) || match;
    });
  }

  // biome-ignore lint/suspicious/noExplicitAny: Pre-existing utility returns dynamic property values
  private evaluateProperty(expression: string): any {
    // Handle $node.property syntax
    const path = expression.substring(1); // Remove $
    return this.getContextValue(path);
  }

  // biome-ignore lint/suspicious/noExplicitAny: Pre-existing utility returns dynamic context values
  private getContextValue(path: string): any {
    const keys = path.split('.');
    let result = this.context;

    for (const key of keys) {
      if (result && typeof result === 'object' && key in result) {
        result = result[key];
      } else {
        return undefined;
      }
    }

    return result;
  }

  // biome-ignore lint/suspicious/noExplicitAny: Pre-existing utility accepts generic expression context
  setContext(context: Record<string, any>): void {
    this.context = context;
  }

  // biome-ignore lint/suspicious/noExplicitAny: Pre-existing utility accepts generic context updates
  updateContext(updates: Record<string, any>): void {
    this.context = { ...this.context, ...updates };
  }
}
