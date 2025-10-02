# Azure Monitoring Module Outputs

output "log_analytics_workspace_id" {
  description = "Log Analytics workspace ID"
  value       = azurerm_log_analytics_workspace.main.id
}

output "log_analytics_workspace_name" {
  description = "Log Analytics workspace name"
  value       = azurerm_log_analytics_workspace.main.name
}

output "log_analytics_workspace_key" {
  description = "Log Analytics workspace primary shared key"
  value       = azurerm_log_analytics_workspace.main.primary_shared_key
  sensitive   = true
}

output "application_insights_id" {
  description = "Application Insights ID"
  value       = azurerm_application_insights.main.id
}

output "application_insights_name" {
  description = "Application Insights name"
  value       = azurerm_application_insights.main.name
}

output "application_insights_instrumentation_key" {
  description = "Application Insights instrumentation key"
  value       = azurerm_application_insights.main.instrumentation_key
  sensitive   = true
}

output "application_insights_connection_string" {
  description = "Application Insights connection string"
  value       = azurerm_application_insights.main.connection_string
  sensitive   = true
}

output "action_group_id" {
  description = "Action group ID"
  value       = azurerm_monitor_action_group.main.id
}

output "dashboard_id" {
  description = "Dashboard ID"
  value       = var.create_dashboard ? azurerm_portal_dashboard.main[0].id : null
}
