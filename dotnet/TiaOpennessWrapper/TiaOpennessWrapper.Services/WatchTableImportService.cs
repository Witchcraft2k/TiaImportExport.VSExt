using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Siemens.Engineering;
using Siemens.Engineering.SW.WatchAndForceTables;
using TiaOpennessWrapper.Models;
using TiaOpennessWrapper.Services.Export;

namespace TiaOpennessWrapper.Services;

public class WatchTableImportService
{
	private readonly IDeviceLocator _devices;

	public WatchTableImportService(IDeviceLocator devices)
	{
		_devices = devices ?? throw new ArgumentNullException("devices");
	}

	public async Task<object> ExportWatchTablesAsync(ProjectBase? currentProject, string deviceId, string exportPath)
	{
		return await Task.Run(delegate
		{
			List<ExportMessage> list = new List<ExportMessage>();
			ExportCounters exportCounters = new ExportCounters();
			try
			{
				var (val, _, obj) = PlcContextResolver.ResolvePlc(_devices, currentProject, deviceId);
				if (obj != null)
				{
					return obj;
				}
				Directory.CreateDirectory(exportPath);
				ExportWatchTablesWithMessages((PlcWatchAndForceTableGroup)(object)val.WatchAndForceTableGroup, exportPath, list, exportCounters);
				return new
				{
					success = true,
					itemCount = exportCounters.Success,
					successCount = exportCounters.Success,
					errorCount = exportCounters.Error,
					skippedCount = exportCounters.Skipped,
					messages = list
				};
			}
			catch (Exception ex)
			{
				list.Add(ExportMessage.Error("ImportWatchTables", "Operation", ex.Message, ex.ToString()));
				return new
				{
					success = false,
					error = ex.Message,
					messages = list
				};
			}
		});
	}

	public async Task<object> ExportWatchTablesFromGroupAsync(ProjectBase? currentProject, string deviceId, string groupName, string groupPath, string exportPath)
	{
		return await Task.Run(delegate
		{
			List<ExportMessage> list = new List<ExportMessage>();
			ExportCounters exportCounters = new ExportCounters();
			try
			{
				var (val, _, obj) = PlcContextResolver.ResolvePlc(_devices, currentProject, deviceId);
				if (obj != null)
				{
					return obj;
				}
				PlcWatchAndForceTableGroup val2 = FindWatchTableGroupByName((PlcWatchAndForceTableGroup)(object)val.WatchAndForceTableGroup, groupName);
				if (val2 == null)
				{
					return new
					{
						success = false,
						error = "Watch table group '" + groupName + "' not found",
						messages = new List<ExportMessage>()
					};
				}
				string text = (string.IsNullOrEmpty(groupPath) ? exportPath : Path.Combine(exportPath, groupPath.Replace("/", Path.DirectorySeparatorChar.ToString())));
				Directory.CreateDirectory(text);
				ExportWatchTablesWithMessages(val2, text, list, exportCounters);
				return new
				{
					success = true,
					itemCount = exportCounters.Success,
					successCount = exportCounters.Success,
					errorCount = exportCounters.Error,
					skippedCount = exportCounters.Skipped,
					filePath = text,
					messages = list
				};
			}
			catch (Exception ex)
			{
				list.Add(ExportMessage.Error("ImportWatchTablesFromGroup", "Operation", ex.Message, ex.ToString()));
				return new
				{
					success = false,
					error = ex.Message,
					messages = list
				};
			}
		});
	}

	public async Task<object> ExportSingleWatchTableAsync(ProjectBase? currentProject, string deviceId, string watchTableId, string exportPath)
	{
		return await Task.Run(delegate
		{
			//IL_01d3: Expected O, but got Unknown
			List<ExportMessage> list = new List<ExportMessage>();
			try
			{
				var (val, _, obj) = PlcContextResolver.ResolvePlc(_devices, currentProject, deviceId);
				if (obj != null)
				{
					return obj;
				}
				var (val2, text) = FindWatchTableByIdWithPath((PlcWatchAndForceTableGroup)(object)val.WatchAndForceTableGroup, watchTableId);
				if (val2 == null)
				{
					return new
					{
						success = false,
						error = "Watch table '" + watchTableId + "' not found",
						messages = new List<ExportMessage>()
					};
				}
				string obj2 = (string.IsNullOrEmpty(text) ? exportPath : Path.Combine(exportPath, text));
				Directory.CreateDirectory(obj2);
				string text2 = val2.Name + ".xml";
				string text3 = Path.Combine(obj2, text2);
				if (File.Exists(text3))
				{
					string text4 = Path.Combine(Path.GetTempPath(), $"tia_compare_{Guid.NewGuid()}_{text2}");
					try
					{
						val2.Export(new FileInfo(text4), (ExportOptions)1);
						if (XmlComparisonService.CompareXmlContent(text3, text4))
						{
							list.Add(ExportMessage.Info(val2.Name, "WatchTable", "No changes: " + text2));
							return new
							{
								success = true,
								itemCount = 0,
								successCount = 0,
								skippedCount = 1,
								filePath = text3,
								messages = list
							};
						}
						File.Copy(text4, text3, overwrite: true);
						list.Add(ExportMessage.Success(val2.Name, "WatchTable", text3, "Updated: " + text2));
					}
					finally
					{
						if (File.Exists(text4))
						{
							File.Delete(text4);
						}
					}
				}
				else
				{
					val2.Export(new FileInfo(text3), (ExportOptions)1);
					list.Add(ExportMessage.Success(val2.Name, "WatchTable", text3, "Imported: " + text2));
				}
				return new
				{
					success = true,
					itemCount = 1,
					successCount = 1,
					skippedCount = 0,
					filePath = text3,
					messages = list
				};
			}
			catch (EngineeringException ex)
			{
				EngineeringException ex2 = ex;
				string text5 = ExtractTiaErrorDetails(ex2);
				list.Add(ExportMessage.Error(watchTableId, "WatchTable", "TIA Portal error: " + ((Exception)(object)ex2).Message, text5));
				return new
				{
					success = false,
					error = text5,
					messages = list
				};
			}
			catch (Exception ex3)
			{
				list.Add(ExportMessage.Error(watchTableId, "WatchTable", ex3.Message, ex3.ToString()));
				return new
				{
					success = false,
					error = ex3.Message,
					messages = list
				};
			}
		});
	}

	public void ExportWatchTablesWithMessages(PlcWatchAndForceTableGroup group, string exportPath, List<ExportMessage> messages, ExportCounters counters)
	{
		//IL_013d: Expected O, but got Unknown
		foreach (PlcWatchTable watchTable in group.WatchTables)
		{
			try
			{
				string text = watchTable.Name + ".xml";
				string text2 = Path.Combine(exportPath, text);
				if (File.Exists(text2))
				{
					string text3 = Path.Combine(Path.GetTempPath(), $"tia_compare_{Guid.NewGuid()}_{text}");
					try
					{
						watchTable.Export(new FileInfo(text3), (ExportOptions)1);
						if (XmlComparisonService.CompareXmlContent(text2, text3))
						{
							messages.Add(ExportMessage.Info(watchTable.Name, "WatchTable", "No changes: " + text));
							counters.Skipped++;
						}
						else
						{
							File.Copy(text3, text2, overwrite: true);
							messages.Add(ExportMessage.Success(watchTable.Name, "WatchTable", text2, "Updated: " + text));
							counters.Success++;
						}
					}
					finally
					{
						if (File.Exists(text3))
						{
							File.Delete(text3);
						}
					}
				}
				else
				{
					watchTable.Export(new FileInfo(text2), (ExportOptions)1);
					messages.Add(ExportMessage.Success(watchTable.Name, "WatchTable", text2, "Imported: " + text));
					counters.Success++;
				}
			}
			catch (EngineeringException ex)
			{
				EngineeringException ex2 = ex;
				string details = ExtractTiaErrorDetails(ex2);
				messages.Add(ExportMessage.Error(watchTable.Name, "WatchTable", "TIA Portal error importing watch table: " + watchTable.Name, details));
				counters.Error++;
			}
			catch (Exception ex3)
			{
				messages.Add(ExportMessage.Error(watchTable.Name, "WatchTable", "Error importing watch table: " + watchTable.Name, ex3.Message));
				counters.Error++;
			}
		}
		foreach (PlcWatchAndForceTableUserGroup group2 in group.Groups)
		{
			string text4 = Path.Combine(exportPath, group2.Name);
			Directory.CreateDirectory(text4);
			ExportWatchTablesWithMessages((PlcWatchAndForceTableGroup)(object)group2, text4, messages, counters);
		}
		if (!Directory.Exists(exportPath))
		{
			return;
		}
		try
		{
			HashSet<string> hashSet = new HashSet<string>(((IEnumerable<PlcWatchTable>)group.WatchTables).Select((PlcWatchTable t) => t.Name), StringComparer.OrdinalIgnoreCase);
			string[] files = Directory.GetFiles(exportPath, "*.xml");
			foreach (string path in files)
			{
				string fileNameWithoutExtension = Path.GetFileNameWithoutExtension(path);
				if (!hashSet.Contains(fileNameWithoutExtension))
				{
					try
					{
						File.Delete(path);
						messages.Add(ExportMessage.Deleted(fileNameWithoutExtension, "WatchTable", "Deleted orphaned file: " + fileNameWithoutExtension + ".xml"));
					}
					catch (Exception ex4)
					{
						messages.Add(ExportMessage.Warning(fileNameWithoutExtension, "WatchTable", "Failed to delete orphaned file: " + fileNameWithoutExtension + ".xml", ex4.Message));
					}
				}
			}
			HashSet<string> hashSet2 = new HashSet<string>(((IEnumerable<PlcWatchAndForceTableUserGroup>)group.Groups).Select((PlcWatchAndForceTableUserGroup g) => g.Name), StringComparer.OrdinalIgnoreCase);
			files = Directory.GetDirectories(exportPath);
			foreach (string path2 in files)
			{
				string fileName = Path.GetFileName(path2);
				if (!hashSet2.Contains(fileName))
				{
					try
					{
						Directory.Delete(path2, recursive: true);
						messages.Add(ExportMessage.Deleted(fileName, "Folder", "Deleted orphaned folder: " + fileName));
					}
					catch (Exception ex5)
					{
						messages.Add(ExportMessage.Warning(fileName, "Folder", "Failed to delete orphaned folder: " + fileName, ex5.Message));
					}
				}
			}
		}
		catch (Exception ex6)
		{
			messages.Add(ExportMessage.Warning("OrphanCleanup", "WatchTable", "Failed to check for orphaned items in: " + exportPath, ex6.Message));
		}
	}

	public void ExportWatchTablesRecursively(PlcWatchAndForceTableGroup group, string exportPath, ref int exportedCount)
	{
		List<ExportMessage> messages = new List<ExportMessage>();
		ExportCounters exportCounters = new ExportCounters
		{
			Success = exportedCount
		};
		ExportWatchTablesWithMessages(group, exportPath, messages, exportCounters);
		exportedCount = exportCounters.Success;
	}

	public PlcWatchAndForceTableGroup? FindWatchTableGroupByName(PlcWatchAndForceTableGroup group, string groupName)
	{
		if (group.Name == groupName)
		{
			return group;
		}
		foreach (PlcWatchAndForceTableUserGroup group2 in group.Groups)
		{
			if (group2.Name == groupName)
			{
				return (PlcWatchAndForceTableGroup?)(object)group2;
			}
			PlcWatchAndForceTableGroup val = FindWatchTableGroupByName((PlcWatchAndForceTableGroup)(object)group2, groupName);
			if (val != null)
			{
				return val;
			}
		}
		return null;
	}

	public (PlcWatchTable? table, string path) FindWatchTableByIdWithPath(PlcWatchAndForceTableGroup group, string watchTableId, string currentPath = "")
	{
		string text = watchTableId;
		int num = watchTableId.IndexOf("Watch and force tables/", StringComparison.OrdinalIgnoreCase);
		if (num >= 0)
		{
			text = watchTableId.Substring(num + "Watch and force tables/".Length);
		}
		string[] array = text.Split(new char[2] { '/', '\\' }, StringSplitOptions.RemoveEmptyEntries);
		string tableName = ((array.Length != 0) ? array[array.Length - 1] : watchTableId);
		string targetGroupPath = ((array.Length > 1) ? string.Join("/", array.Take(array.Length - 1)) : "");
		return FindWatchTableByNameAndPath(group, tableName, targetGroupPath, currentPath);
	}

	private (PlcWatchTable? table, string path) FindWatchTableByNameAndPath(PlcWatchAndForceTableGroup group, string tableName, string targetGroupPath, string currentPath)
	{
		string text = currentPath.Replace('\\', '/');
		string value = targetGroupPath.Replace('\\', '/');
		if (text.Equals(value, StringComparison.OrdinalIgnoreCase))
		{
			foreach (PlcWatchTable watchTable in group.WatchTables)
			{
				if (watchTable.Name.Equals(tableName, StringComparison.OrdinalIgnoreCase))
				{
					return (table: watchTable, path: currentPath);
				}
			}
		}
		foreach (PlcWatchAndForceTableUserGroup group2 in group.Groups)
		{
			string currentPath2 = (string.IsNullOrEmpty(currentPath) ? group2.Name : Path.Combine(currentPath, group2.Name));
			var (val, item) = FindWatchTableByNameAndPath((PlcWatchAndForceTableGroup)(object)group2, tableName, targetGroupPath, currentPath2);
			if (val != null)
			{
				return (table: val, path: item);
			}
		}
		return (table: null, path: "");
	}

	private string ExtractTiaErrorDetails(EngineeringException ex)
	{
		List<string> list = new List<string>();
		list.Add("Error: " + ((Exception)(object)ex).Message);
		Exception innerException = ((Exception)(object)ex).InnerException;
		int num = 0;
		while (innerException != null && num < 5)
		{
			list.Add("Caused by: " + innerException.Message);
			innerException = innerException.InnerException;
			num++;
		}
		string text = ((Exception)(object)ex).Message.ToLower();
		if (text.Contains("access") || text.Contains("permission"))
		{
			list.Add("");
			list.Add("Solution: Ensure you have sufficient permissions and TIA Portal is running with appropriate access rights.");
		}
		else if (text.Contains("not found") || text.Contains("does not exist"))
		{
			list.Add("");
			list.Add("Solution: Verify the item exists in the TIA Portal project. The project may need to be refreshed.");
		}
		return string.Join("\n", list);
	}
}

