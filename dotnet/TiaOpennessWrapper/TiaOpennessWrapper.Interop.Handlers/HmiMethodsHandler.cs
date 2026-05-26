using System;
using System.Threading.Tasks;
using TiaOpennessWrapper.Models;

namespace TiaOpennessWrapper.Interop.Handlers;

internal class HmiMethodsHandler
{
	private readonly Func<TiaPortalService?> _getService;

	internal HmiMethodsHandler(Func<TiaPortalService?> getService)
	{
		_getService = getService;
	}

	private static TiaExportOptions CreateOptions(dynamic parameters)
	{
		return new TiaExportOptions
		{
			IncludeComments = TiaRequestBinder.GetOptionalBool(parameters, "includeComments", true),
			Format = TiaRequestBinder.GetOptionalString(parameters, "format", "xml"),
			OverwriteExisting = TiaRequestBinder.GetOptionalBool(parameters, "overwriteExisting", true)
		};
	}

	private static string GetProjectName(dynamic parameters)
	{
		return TiaRequestBinder.GetOptionalString(parameters, "projectName", "") ?? "";
	}

	internal async Task<object> ExportHmiScreens(dynamic parameters)
	{
		if (!TiaConnectionGuard.TryGetService(_getService(), out TiaPortalService connectedService, out object errorResult))
		{
			return errorResult;
		}
		return await connectedService.ExportHmiScreensAsync(GetProjectName(parameters), (string)parameters.deviceId, (string)parameters.exportPath, CreateOptions(parameters));
	}

	internal async Task<object> ExportHmiTags(dynamic parameters)
	{
		if (!TiaConnectionGuard.TryGetService(_getService(), out TiaPortalService connectedService, out object errorResult))
		{
			return errorResult;
		}
		return await connectedService.ExportHmiTagsAsync(GetProjectName(parameters), (string)parameters.deviceId, (string)parameters.exportPath, CreateOptions(parameters));
	}

	internal async Task<object> ExportHmiConnections(dynamic parameters)
	{
		if (!TiaConnectionGuard.TryGetService(_getService(), out TiaPortalService connectedService, out object errorResult))
		{
			return errorResult;
		}
		return await connectedService.ExportHmiConnectionsAsync(GetProjectName(parameters), (string)parameters.deviceId, (string)parameters.exportPath, CreateOptions(parameters));
	}

	internal async Task<object> ExportAllHmi(dynamic parameters)
	{
		if (!TiaConnectionGuard.TryGetService(_getService(), out TiaPortalService connectedService, out object errorResult))
		{
			return errorResult;
		}
		return await connectedService.ExportAllHmiAsync(GetProjectName(parameters), (string)parameters.deviceId, (string)parameters.exportPath, CreateOptions(parameters));
	}
}
