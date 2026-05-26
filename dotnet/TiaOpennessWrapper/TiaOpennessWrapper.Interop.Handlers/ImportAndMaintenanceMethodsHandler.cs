using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using TiaOpennessWrapper.Models;
using TiaOpennessWrapper.Services;

namespace TiaOpennessWrapper.Interop.Handlers;

internal class ImportAndMaintenanceMethodsHandler
{
	private readonly Func<TiaPortalService?> _getService;

	internal ImportAndMaintenanceMethodsHandler(Func<TiaPortalService?> getService)
	{
		_getService = getService;
	}

	private static string GetProjectName(dynamic parameters)
	{
		return TiaRequestBinder.GetOptionalString(parameters, "projectName", "") ?? "";
	}

	internal Task<object> CleanExportCaches(dynamic parameters)
	{
		if (!TiaConnectionGuard.TryGetService(_getService(), out TiaPortalService connectedService, out object errorResult))
		{
			return Task.FromResult(errorResult);
		}
		connectedService.CleanExportCaches(TiaRequestBinder.GetOptionalString(parameters, "basePath", null));
		return Task.FromResult((object)new
		{
			success = true
		});
	}

	internal async Task<object> ImportXmlFileToTia(dynamic parameters)
	{
		if (!TiaConnectionGuard.TryGetService(_getService(), out TiaPortalService connectedService, out object errorResult))
		{
			return errorResult;
		}
		return await connectedService.ImportXmlFileToTiaAsync(GetProjectName(parameters), (string)parameters.deviceId, (string)parameters.xmlFilePath, TiaRequestBinder.GetOptionalBool(parameters, "overwriteExisting", true), TiaRequestBinder.GetOptionalString(parameters, "basePath", null), TiaRequestBinder.GetOptionalBool(parameters, "compareBeforeImport", false));
	}

	internal async Task<object> ImportXmlFolderToTia(dynamic parameters)
	{
		if (!TiaConnectionGuard.TryGetService(_getService(), out TiaPortalService connectedService, out object errorResult))
		{
			return errorResult;
		}
		return await connectedService.ImportXmlFolderToTiaAsync(GetProjectName(parameters), (string)parameters.deviceId, (string)parameters.folderPath, TiaRequestBinder.GetOptionalBool(parameters, "overwriteExisting", true), TiaRequestBinder.GetOptionalBool(parameters, "recursive", true));
	}

	internal async Task<object> ImportXlsxFileToTia(dynamic parameters)
	{
		if (!TiaConnectionGuard.TryGetService(_getService(), out TiaPortalService service, out object errorResult))
		{
			return errorResult;
		}
		return await Task.Run(delegate
		{
			List<ExportMessage> messages = new List<ExportMessage>();
			try
			{
				string xlsxFilePath = (string)parameters.xlsxFilePath;
				string deviceId = (string)parameters.deviceId;
				bool overwriteExisting = TiaRequestBinder.GetOptionalBool(parameters, "overwriteExisting", true);
				bool compareBeforeImport = TiaRequestBinder.GetOptionalBool(parameters, "compareBeforeImport", false);
				List<string> conversionMessages = new List<string>();
				string tempDirectory = Path.Combine(Path.GetTempPath(), $"tia_xlsx_{Guid.NewGuid()}");
				Directory.CreateDirectory(tempDirectory);
				string outputXmlPath = Path.Combine(tempDirectory, Path.ChangeExtension(Path.GetFileName(xlsxFilePath), ".xml"));
				try
				{
					string convertedXmlPath = TagTableXlsxToXmlConverter.ConvertToXml(xlsxFilePath, outputXmlPath, conversionMessages);
					if (convertedXmlPath == null)
					{
						foreach (string item in conversionMessages)
						{
							messages.Add(ExportMessage.Error("XLSX", "Conversion", item, ""));
						}
						return new
						{
							success = false,
							error = "Failed to convert XLSX to XML",
							messages
						};
					}
					messages.Add(ExportMessage.Info("XLSX", "Conversion", "Converted to XML: " + Path.GetFileName(convertedXmlPath)));
					return service.ImportXmlFileToTiaAsync(GetProjectName(parameters), deviceId, convertedXmlPath, overwriteExisting, null, compareBeforeImport, xlsxFilePath).GetAwaiter().GetResult();
				}
				finally
				{
					try
					{
						Directory.Delete(tempDirectory, recursive: true);
					}
					catch
					{
					}
				}
			}
			catch (Exception ex)
			{
				messages.Add(ExportMessage.Error("XLSX", "Import", ex.Message, ex.ToString()));
				return new
				{
					success = false,
					error = ex.Message,
					messages
				};
			}
		});
	}

	internal async Task<object> ImportXlsxFolderToTia(dynamic parameters)
	{
		if (!TiaConnectionGuard.TryGetService(_getService(), out TiaPortalService service, out object errorResult))
		{
			return errorResult;
		}
		return await Task.Run((Func<object>)delegate
		{
			List<ExportMessage> messages = new List<ExportMessage>();
			try
			{
				string folderPath = (string)parameters.folderPath;
				string deviceId = (string)parameters.deviceId;
				bool overwriteExisting = TiaRequestBinder.GetOptionalBool(parameters, "overwriteExisting", true);
				bool compareBeforeImport = TiaRequestBinder.GetOptionalBool(parameters, "compareBeforeImport", false);
				string[] files = Directory.GetFiles(folderPath, "*.xlsx", SearchOption.AllDirectories);
				if (files.Length == 0)
				{
					return new
					{
						success = false,
						error = "No XLSX files found in folder",
						messages
					};
				}
				string tempDirectory = Path.Combine(Path.GetTempPath(), $"tia_xlsx_{Guid.NewGuid()}");
				Directory.CreateDirectory(tempDirectory);
				try
				{
					int successCount = 0;
					int errorCount = 0;
					foreach (string xlsxFilePath in files)
					{
						string outputXmlPath = Path.Combine(tempDirectory, Path.ChangeExtension(Path.GetFileName(xlsxFilePath), ".xml"));
						List<string> conversionMessages = new List<string>();
						string convertedXmlPath = TagTableXlsxToXmlConverter.ConvertToXml(xlsxFilePath, outputXmlPath, conversionMessages);
						if (convertedXmlPath == null)
						{
							foreach (string item in conversionMessages)
							{
								messages.Add(ExportMessage.Error("XLSX", "Conversion", item, ""));
							}
							errorCount++;
							continue;
						}
						messages.Add(ExportMessage.Info("XLSX", "Conversion", "Converted: " + Path.GetFileName(xlsxFilePath)));
						try
						{
							dynamic result = service.ImportXmlFileToTiaAsync(GetProjectName(parameters), deviceId, convertedXmlPath, overwriteExisting, null, compareBeforeImport, xlsxFilePath).GetAwaiter().GetResult();
							if ((bool)result.success)
							{
								successCount++;
								messages.Add(ExportMessage.Success(Path.GetFileNameWithoutExtension(xlsxFilePath), "TagTable", xlsxFilePath, "Imported to TIA Portal"));
							}
							else
							{
								errorCount++;
								string message = result.error?.ToString() ?? "Unknown error";
								messages.Add(ExportMessage.Error(Path.GetFileNameWithoutExtension(xlsxFilePath), "TagTable", message, ""));
							}
						}
						catch (Exception ex)
						{
							errorCount++;
							messages.Add(ExportMessage.Error(Path.GetFileNameWithoutExtension(xlsxFilePath), "TagTable", ex.Message, ex.ToString()));
						}
					}
					return new
					{
						success = (errorCount == 0),
						itemCount = successCount + errorCount,
						successCount,
						errorCount,
						messages
					};
				}
				finally
				{
					try
					{
						Directory.Delete(tempDirectory, recursive: true);
					}
					catch
					{
					}
				}
			}
			catch (Exception ex2)
			{
				messages.Add(ExportMessage.Error("XLSX", "Import", ex2.Message, ex2.ToString()));
				return new
				{
					success = false,
					error = ex2.Message,
					messages
				};
			}
		});
	}

	internal async Task<object> CreateInstanceDB(dynamic parameters)
	{
		if (!TiaConnectionGuard.TryGetService(_getService(), out TiaPortalService connectedService, out object errorResult))
		{
			return errorResult;
		}
		return await connectedService.CreateInstanceDBAsync((string)parameters.deviceId, (string)parameters.instanceDbName, (string)parameters.instanceOfName, TiaRequestBinder.GetOptionalInt(parameters, "blockNumber", 0), TiaRequestBinder.GetOptionalString(parameters, "groupPath", null));
	}

	internal async Task<object> CreateBlockGroups(dynamic parameters)
	{
		if (!TiaConnectionGuard.TryGetService(_getService(), out TiaPortalService connectedService, out object errorResult))
		{
			return errorResult;
		}
		List<string> list = new List<string>();
		foreach (dynamic item in parameters.groupPaths)
		{
			list.Add((string)item);
		}
		return await connectedService.CreateBlockGroupsAsync((string)parameters.deviceId, list.ToArray(), TiaRequestBinder.GetOptionalString(parameters, "basePath", null));
	}

	internal async Task<object> DeleteOrphanedBlockGroups(dynamic parameters)
	{
		if (!TiaConnectionGuard.TryGetService(_getService(), out TiaPortalService connectedService, out object errorResult))
		{
			return errorResult;
		}
		return await connectedService.DeleteOrphanedBlockGroupsAsync((string)parameters.deviceId, (string)parameters.localFolderPath, TiaRequestBinder.GetOptionalString(parameters, "basePath", null));
	}

	internal async Task<object> DeleteOrphanedTagTables(dynamic parameters)
	{
		if (!TiaConnectionGuard.TryGetService(_getService(), out TiaPortalService connectedService, out object errorResult))
		{
			return errorResult;
		}
		return await connectedService.DeleteOrphanedTagTablesAsync((string)parameters.deviceId, (string)parameters.localFolderPath);
	}

	internal async Task<object> DeleteOrphanedTypes(dynamic parameters)
	{
		if (!TiaConnectionGuard.TryGetService(_getService(), out TiaPortalService connectedService, out object errorResult))
		{
			return errorResult;
		}
		return await connectedService.DeleteOrphanedTypesAsync((string)parameters.deviceId, (string)parameters.localFolderPath);
	}

	internal async Task<object> DeleteOrphanedWatchTables(dynamic parameters)
	{
		if (!TiaConnectionGuard.TryGetService(_getService(), out TiaPortalService connectedService, out object errorResult))
		{
			return errorResult;
		}
		return await connectedService.DeleteOrphanedWatchTablesAsync((string)parameters.deviceId, (string)parameters.localFolderPath);
	}

	internal async Task<object> CompileSoftware(dynamic parameters)
	{
		if (!TiaConnectionGuard.TryGetService(_getService(), out TiaPortalService connectedService, out object errorResult))
		{
			return errorResult;
		}
		return await connectedService.CompileSoftwareAsync((string)parameters.deviceId);
	}
}
