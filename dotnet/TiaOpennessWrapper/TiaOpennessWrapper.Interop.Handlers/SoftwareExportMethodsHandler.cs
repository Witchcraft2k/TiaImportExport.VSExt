using System;
using System.Threading.Tasks;
using TiaOpennessWrapper.Models;

namespace TiaOpennessWrapper.Interop.Handlers;

internal class SoftwareExportMethodsHandler
{
	private readonly Func<TiaPortalService?> _getService;

	internal SoftwareExportMethodsHandler(Func<TiaPortalService?> getService)
	{
		_getService = getService;
	}

	private static TiaExportOptions CreateBlockOptions(dynamic parameters, bool includeExcludeSystemBlocks = false)
	{
		TiaExportOptions tiaExportOptions = new TiaExportOptions
		{
			IncludeComments = TiaRequestBinder.GetOptionalBool(parameters, "includeComments", true),
			Format = TiaRequestBinder.GetOptionalString(parameters, "format", "xml"),
			DbExportFormat = TiaRequestBinder.GetOptionalString(parameters, "dbExportFormat", "xml")
		};
		if (includeExcludeSystemBlocks)
		{
			tiaExportOptions.ExcludeSystemBlocks = TiaRequestBinder.GetOptionalBool(parameters, "excludeSystemBlocks", true);
		}
		return tiaExportOptions;
	}

	private static TiaExportOptions CreateTagExportOptions(dynamic parameters)
	{
		return new TiaExportOptions
		{
			IncludeComments = TiaRequestBinder.GetOptionalBool(parameters, "includeComments", true),
			Format = TiaRequestBinder.GetOptionalString(parameters, "format", "xml"),
			GenerateXlsx = TiaRequestBinder.GetOptionalBool(parameters, "generateXlsx", false)
		};
	}

	private static bool GetGenerateXlsx(dynamic parameters)
	{
		bool optionalBool = TiaRequestBinder.GetOptionalBool(parameters, "generateXlsx", false);
		if (optionalBool)
		{
			return true;
		}
		try
		{
			return (bool)parameters.generateXlsx;
		}
		catch
		{
			return false;
		}
	}

	internal async Task<object> ExportBlocks(dynamic parameters)
	{
		if (!TiaConnectionGuard.TryGetService(_getService(), out TiaPortalService connectedService, out object errorResult))
		{
			return errorResult;
		}
		return await connectedService.ExportBlocksAsync((string)parameters.projectName, (string)parameters.deviceId, (string)parameters.plcId, (string)parameters.exportPath, CreateBlockOptions(parameters, includeExcludeSystemBlocks: true));
	}

	internal async Task<object> ExportBlock(dynamic parameters)
	{
		if (!TiaConnectionGuard.TryGetService(_getService(), out TiaPortalService connectedService, out object errorResult))
		{
			return errorResult;
		}
		return await connectedService.ExportBlockAsync((string)parameters.projectName, (string)parameters.deviceId, (string)parameters.blockId, (string)parameters.exportPath, CreateBlockOptions(parameters));
	}

	internal async Task<object> ExportBlockWithPath(dynamic parameters)
	{
		if (!TiaConnectionGuard.TryGetService(_getService(), out TiaPortalService connectedService, out object errorResult))
		{
			return errorResult;
		}
		return await connectedService.ExportBlockWithPathAsync((string)parameters.projectName, (string)parameters.deviceId, (string)parameters.blockId, TiaRequestBinder.GetOptionalString(parameters, "groupPath", "") ?? "", (string)parameters.exportPath, CreateBlockOptions(parameters));
	}

	internal async Task<object> ExportBlockGroup(dynamic parameters)
	{
		if (!TiaConnectionGuard.TryGetService(_getService(), out TiaPortalService connectedService, out object errorResult))
		{
			return errorResult;
		}
		return await connectedService.ExportBlockGroupAsync((string)parameters.projectName, (string)parameters.deviceId, (string)parameters.plcId, (string)parameters.groupId, (string)parameters.exportPath, CreateBlockOptions(parameters, includeExcludeSystemBlocks: true));
	}

	internal async Task<object> ExportBlockGroupWithPath(dynamic parameters)
	{
		if (!TiaConnectionGuard.TryGetService(_getService(), out TiaPortalService connectedService, out object errorResult))
		{
			return errorResult;
		}
		return await connectedService.ExportBlockGroupWithPathAsync((string)parameters.projectName, (string)parameters.deviceId, (string)parameters.plcId, (string)parameters.groupId, TiaRequestBinder.GetOptionalString(parameters, "groupName", "") ?? "", TiaRequestBinder.GetOptionalString(parameters, "groupPath", "") ?? "", (string)parameters.exportPath, CreateBlockOptions(parameters, includeExcludeSystemBlocks: true));
	}

	internal async Task<object> ExportTagTables(dynamic parameters)
	{
		if (!TiaConnectionGuard.TryGetService(_getService(), out TiaPortalService connectedService, out object errorResult))
		{
			return errorResult;
		}
		return await connectedService.ExportTagTablesAsync((string)parameters.projectName, (string)parameters.deviceId, (string)parameters.plcId, (string)parameters.exportPath, CreateTagExportOptions(parameters));
	}

	internal async Task<object> ExportUserDataTypes(dynamic parameters)
	{
		if (!TiaConnectionGuard.TryGetService(_getService(), out TiaPortalService connectedService, out object errorResult))
		{
			return errorResult;
		}
		return await connectedService.ExportUserDataTypesAsync((string)parameters.projectName, (string)parameters.deviceId, (string)parameters.plcId, (string)parameters.exportPath, new TiaExportOptions
		{
			IncludeComments = TiaRequestBinder.GetOptionalBool(parameters, "includeComments", true),
			Format = TiaRequestBinder.GetOptionalString(parameters, "format", "xml")
		});
	}

	internal async Task<object> ExportWatchTables(dynamic parameters)
	{
		if (!TiaConnectionGuard.TryGetService(_getService(), out TiaPortalService connectedService, out object errorResult))
		{
			return errorResult;
		}
		return await connectedService.ExportWatchTablesAsync((string)parameters.projectName, (string)parameters.deviceId, (string)parameters.plcId, (string)parameters.exportPath, new TiaExportOptions
		{
			IncludeComments = TiaRequestBinder.GetOptionalBool(parameters, "includeComments", true),
			Format = TiaRequestBinder.GetOptionalString(parameters, "format", "xml")
		});
	}

	internal async Task<object> ExportSingleTagTable(dynamic parameters)
	{
		if (!TiaConnectionGuard.TryGetService(_getService(), out TiaPortalService connectedService, out object errorResult))
		{
			return errorResult;
		}
		return await connectedService.ExportSingleTagTableAsync((string)parameters.projectName, (string)parameters.deviceId, (string)parameters.plcId, (string)parameters.tagTableId, (string)parameters.exportPath, GetGenerateXlsx(parameters));
	}

	internal async Task<object> ExportSingleUdt(dynamic parameters)
	{
		if (!TiaConnectionGuard.TryGetService(_getService(), out TiaPortalService connectedService, out object errorResult))
		{
			return errorResult;
		}
		return await connectedService.ExportSingleUdtAsync((string)parameters.projectName, (string)parameters.deviceId, (string)parameters.plcId, (string)parameters.udtId, (string)parameters.exportPath);
	}

	internal async Task<object> ExportSingleWatchTable(dynamic parameters)
	{
		if (!TiaConnectionGuard.TryGetService(_getService(), out TiaPortalService connectedService, out object errorResult))
		{
			return errorResult;
		}
		return await connectedService.ExportSingleWatchTableAsync((string)parameters.projectName, (string)parameters.deviceId, (string)parameters.plcId, (string)parameters.watchTableId, (string)parameters.exportPath);
	}

	internal async Task<object> ExportTagTablesFromGroup(dynamic parameters)
	{
		if (!TiaConnectionGuard.TryGetService(_getService(), out TiaPortalService connectedService, out object errorResult))
		{
			return errorResult;
		}
		return await connectedService.ExportTagTablesFromGroupAsync((string)parameters.projectName, (string)parameters.deviceId, (string)parameters.plcId, TiaRequestBinder.GetOptionalString(parameters, "groupName", "") ?? "", TiaRequestBinder.GetOptionalString(parameters, "groupPath", "") ?? "", (string)parameters.exportPath, GetGenerateXlsx(parameters));
	}

	internal async Task<object> ExportUdtsFromGroup(dynamic parameters)
	{
		if (!TiaConnectionGuard.TryGetService(_getService(), out TiaPortalService connectedService, out object errorResult))
		{
			return errorResult;
		}
		return await connectedService.ExportUdtsFromGroupAsync((string)parameters.projectName, (string)parameters.deviceId, (string)parameters.plcId, TiaRequestBinder.GetOptionalString(parameters, "groupName", "") ?? "", TiaRequestBinder.GetOptionalString(parameters, "groupPath", "") ?? "", (string)parameters.exportPath);
	}

	internal async Task<object> ExportWatchTablesFromGroup(dynamic parameters)
	{
		if (!TiaConnectionGuard.TryGetService(_getService(), out TiaPortalService connectedService, out object errorResult))
		{
			return errorResult;
		}
		return await connectedService.ExportWatchTablesFromGroupAsync((string)parameters.projectName, (string)parameters.deviceId, (string)parameters.plcId, TiaRequestBinder.GetOptionalString(parameters, "groupName", "") ?? "", TiaRequestBinder.GetOptionalString(parameters, "groupPath", "") ?? "", (string)parameters.exportPath);
	}

	internal async Task<object> ExportLibraryTypes(dynamic parameters)
	{
		if (!TiaConnectionGuard.TryGetService(_getService(), out TiaPortalService connectedService, out object errorResult))
		{
			return errorResult;
		}
		return await connectedService.ExportLibraryTypesAsync((string)parameters.projectName, (string)parameters.exportPath, CreateBlockOptions(parameters));
	}

	internal async Task<object> ExportLibraryFolder(dynamic parameters)
	{
		if (!TiaConnectionGuard.TryGetService(_getService(), out TiaPortalService connectedService, out object errorResult))
		{
			return errorResult;
		}
		return await connectedService.ExportLibraryFolderAsync((string)parameters.projectName, TiaRequestBinder.GetOptionalString(parameters, "folderPath", "") ?? "", (string)parameters.exportPath, CreateBlockOptions(parameters));
	}

	internal async Task<object> ExportLibraryType(dynamic parameters)
	{
		if (!TiaConnectionGuard.TryGetService(_getService(), out TiaPortalService connectedService, out object errorResult))
		{
			return errorResult;
		}
		return await connectedService.ExportLibraryTypeAsync((string)parameters.projectName, TiaRequestBinder.GetOptionalString(parameters, "folderPath", "") ?? "", (string)parameters.typeName, (string)parameters.exportPath, CreateBlockOptions(parameters));
	}

	internal async Task<object> ExportCrossReferences(dynamic parameters)
	{
		if (!TiaConnectionGuard.TryGetService(_getService(), out TiaPortalService connectedService, out object errorResult))
		{
			return errorResult;
		}
		return await connectedService.ExportCrossReferencesAsync((string)parameters.deviceId, (string)parameters.outputDirectory, TiaRequestBinder.GetOptionalBool(parameters, "includeUnused", true), TiaRequestBinder.GetOptionalBool(parameters, "includeMarkdown", true));
	}
}
