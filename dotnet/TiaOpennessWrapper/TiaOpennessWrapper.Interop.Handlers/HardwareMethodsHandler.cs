using System;
using System.Threading.Tasks;

namespace TiaOpennessWrapper.Interop.Handlers;

internal class HardwareMethodsHandler
{
	private readonly Func<TiaPortalService?> _getService;

	internal HardwareMethodsHandler(Func<TiaPortalService?> getService)
	{
		_getService = getService;
	}

	internal async Task<object> ImportHwConfig(dynamic parameters)
	{
		if (!TiaConnectionGuard.TryGetService(_getService(), out TiaPortalService connectedService, out object errorResult))
		{
			return errorResult;
		}
		return await connectedService.ImportHwConfigAsync(TiaRequestBinder.GetOptionalBool(parameters, "includeChannels", true), TiaRequestBinder.GetOptionalBool(parameters, "includeAddresses", true), TiaRequestBinder.GetOptionalBool(parameters, "includeNetworkConfig", true), TiaRequestBinder.GetOptionalBool(parameters, "includeSubnets", true), TiaRequestBinder.GetOptionalBool(parameters, "exportToXml", false), TiaRequestBinder.GetOptionalString(parameters, "exportPath", null), TiaRequestBinder.GetOptionalString(parameters, "format", null));
	}

	internal async Task<object> ImportDeviceHwConfig(dynamic parameters)
	{
		if (!TiaConnectionGuard.TryGetService(_getService(), out TiaPortalService connectedService, out object errorResult))
		{
			return errorResult;
		}
		return await connectedService.ImportDeviceHwConfigAsync((string)parameters.deviceName, TiaRequestBinder.GetOptionalBool(parameters, "includeChannels", true), TiaRequestBinder.GetOptionalBool(parameters, "includeAddresses", true), TiaRequestBinder.GetOptionalBool(parameters, "includeNetworkConfig", true), TiaRequestBinder.GetOptionalBool(parameters, "exportToXml", false), TiaRequestBinder.GetOptionalString(parameters, "exportPath", null), TiaRequestBinder.GetOptionalString(parameters, "format", null));
	}

	internal async Task<object> ExportHwConfigFileToTia(dynamic parameters)
	{
		if (!TiaConnectionGuard.TryGetService(_getService(), out TiaPortalService connectedService, out object errorResult))
		{
			return errorResult;
		}
		return await connectedService.ExportHwConfigFileToTiaAsync((string)parameters.xmlFilePath, TiaRequestBinder.GetOptionalBool(parameters, "overwriteExisting", false), TiaRequestBinder.GetOptionalBool(parameters, "updateExisting", true), TiaRequestBinder.GetOptionalBool(parameters, "importNetworkConfig", true), TiaRequestBinder.GetOptionalBool(parameters, "skipIfIdentical", true), TiaRequestBinder.GetOptionalBool(parameters, "showComparisonDetails", true), TiaRequestBinder.GetOptionalString(parameters, "format", null));
	}

	internal async Task<object> ExportHwConfigFolderToTia(dynamic parameters)
	{
		if (!TiaConnectionGuard.TryGetService(_getService(), out TiaPortalService connectedService, out object errorResult))
		{
			return errorResult;
		}
		return await connectedService.ExportHwConfigFolderToTiaAsync((string)parameters.folderPath, TiaRequestBinder.GetOptionalBool(parameters, "overwriteExisting", false), TiaRequestBinder.GetOptionalBool(parameters, "updateExisting", true), TiaRequestBinder.GetOptionalBool(parameters, "importNetworkConfig", true), TiaRequestBinder.GetOptionalBool(parameters, "skipIfIdentical", true), TiaRequestBinder.GetOptionalBool(parameters, "showComparisonDetails", true), TiaRequestBinder.GetOptionalString(parameters, "format", null));
	}
}
