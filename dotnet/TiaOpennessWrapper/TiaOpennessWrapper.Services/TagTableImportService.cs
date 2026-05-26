using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Siemens.Engineering;
using Siemens.Engineering.SW.Tags;
using TiaOpennessWrapper.Models;
using TiaOpennessWrapper.Services.Export;

namespace TiaOpennessWrapper.Services;

public class TagTableImportService
{
	private readonly IDeviceLocator _devices;

	public TagTableImportService(IDeviceLocator devices)
	{
		_devices = devices ?? throw new ArgumentNullException("devices");
	}

	public async Task<object> ExportTagTablesAsync(ProjectBase? currentProject, string deviceId, string exportPath, bool generateXlsx = false)
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
				ExportTagTablesWithMessages((PlcTagTableGroup)(object)val.TagTableGroup, exportPath, list, exportCounters);
				int num = 0;
				if (generateXlsx)
				{
					try
					{
						List<string> list2 = new List<string>();
						num = TagTableXlsxConverter.ConvertDirectoryToXlsx(exportPath, list2, deleteXmlAfterConversion: true);
						list.Add(ExportMessage.Info("XLSX", "TagTable", $"Generated {num} XLSX file(s)"));
						foreach (string item in list2)
						{
							list.Add(ExportMessage.Info("XLSX", "Debug", item));
						}
					}
					catch (Exception ex)
					{
						list.Add(ExportMessage.Error("XLSX", "TagTable", "XLSX conversion failed: " + ex.Message, ex.ToString()));
					}
				}
				return new
				{
					success = true,
					itemCount = exportCounters.Success,
					successCount = exportCounters.Success,
					errorCount = exportCounters.Error,
					skippedCount = exportCounters.Skipped,
					xlsxCount = num,
					messages = list
				};
			}
			catch (Exception ex2)
			{
				list.Add(ExportMessage.Error("ImportTagTables", "Operation", ex2.Message, ex2.ToString()));
				return new
				{
					success = false,
					error = ex2.Message,
					messages = list
				};
			}
		});
	}

	public async Task<object> ExportTagTablesFromGroupAsync(ProjectBase? currentProject, string deviceId, string groupName, string groupPath, string exportPath, bool generateXlsx = false)
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
				PlcTagTableGroup val2 = FindTagTableGroupByName((PlcTagTableGroup)(object)val.TagTableGroup, groupName);
				if (val2 == null)
				{
					return new
					{
						success = false,
						error = "Tag table group '" + groupName + "' not found",
						messages = new List<ExportMessage>()
					};
				}
				string text = (string.IsNullOrEmpty(groupPath) ? exportPath : Path.Combine(exportPath, groupPath.Replace("/", Path.DirectorySeparatorChar.ToString())));
				Directory.CreateDirectory(text);
				ExportTagTablesWithMessages(val2, text, list, exportCounters);
				int num = 0;
				if (generateXlsx)
				{
					try
					{
						List<string> list2 = new List<string>();
						num = TagTableXlsxConverter.ConvertDirectoryToXlsx(text, list2, deleteXmlAfterConversion: true);
						list.Add(ExportMessage.Info("XLSX", "TagTable", $"Generated {num} XLSX file(s)"));
						foreach (string item in list2)
						{
							list.Add(ExportMessage.Info("XLSX", "Debug", item));
						}
					}
					catch (Exception ex)
					{
						list.Add(ExportMessage.Error("XLSX", "TagTable", "XLSX conversion failed: " + ex.Message, ex.ToString()));
					}
				}
				return new
				{
					success = true,
					itemCount = exportCounters.Success,
					successCount = exportCounters.Success,
					errorCount = exportCounters.Error,
					skippedCount = exportCounters.Skipped,
					xlsxCount = num,
					filePath = text,
					messages = list
				};
			}
			catch (Exception ex2)
			{
				list.Add(ExportMessage.Error("ImportTagTablesFromGroup", "Operation", ex2.Message, ex2.ToString()));
				return new
				{
					success = false,
					error = ex2.Message,
					messages = list
				};
			}
		});
	}

	public async Task<object> ExportSingleTagTableAsync(ProjectBase? currentProject, string deviceId, string tagTableId, string exportPath, bool generateXlsx = false)
	{
		return await Task.Run(delegate
		{
			//IL_0378: Expected O, but got Unknown
			List<ExportMessage> list = new List<ExportMessage>();
			try
			{
				var (val, _, obj) = PlcContextResolver.ResolvePlc(_devices, currentProject, deviceId);
				if (obj != null)
				{
					return obj;
				}
				var (val2, text) = FindTagTableByIdWithPath((PlcTagTableGroup)(object)val.TagTableGroup, tagTableId);
				if (val2 == null)
				{
					return new
					{
						success = false,
						error = "Tag table '" + tagTableId + "' not found",
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
							list.Add(ExportMessage.Info(val2.Name, "TagTable", "No changes: " + text2));
							string text5 = null;
							if (generateXlsx)
							{
								try
								{
									List<string> list2 = new List<string>();
									text5 = TagTableXlsxConverter.ConvertToXlsx(text3, list2);
									if (text5 != null)
									{
										list.Add(ExportMessage.Info(val2.Name, "TagTable", "Generated XLSX: " + Path.GetFileName(text5)));
										try
										{
											File.Delete(text3);
										}
										catch
										{
										}
									}
									foreach (string item in list2)
									{
										list.Add(ExportMessage.Info("XLSX", "Debug", item));
									}
								}
								catch (Exception ex)
								{
									list.Add(ExportMessage.Error("XLSX", "TagTable", "XLSX conversion failed: " + ex.Message, ex.ToString()));
								}
							}
							return new
							{
								success = true,
								itemCount = 0,
								successCount = 0,
								skippedCount = 1,
								filePath = text3,
								xlsxPath = text5,
								messages = list
							};
						}
						File.Copy(text4, text3, overwrite: true);
						list.Add(ExportMessage.Success(val2.Name, "TagTable", text3, "Updated: " + text2));
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
					list.Add(ExportMessage.Success(val2.Name, "TagTable", text3, "Imported: " + text2));
				}
				string text6 = null;
				if (generateXlsx)
				{
					try
					{
						List<string> list3 = new List<string>();
						text6 = TagTableXlsxConverter.ConvertToXlsx(text3, list3);
						if (text6 != null)
						{
							list.Add(ExportMessage.Info(val2.Name, "TagTable", "Generated XLSX: " + Path.GetFileName(text6)));
							try
							{
								File.Delete(text3);
							}
							catch
							{
							}
						}
						foreach (string item2 in list3)
						{
							list.Add(ExportMessage.Info("XLSX", "Debug", item2));
						}
					}
					catch (Exception ex2)
					{
						list.Add(ExportMessage.Error("XLSX", "TagTable", "XLSX conversion failed: " + ex2.Message, ex2.ToString()));
					}
				}
				return new
				{
					success = true,
					itemCount = 1,
					successCount = 1,
					skippedCount = 0,
					filePath = text3,
					xlsxPath = text6,
					messages = list
				};
			}
			catch (EngineeringException ex3)
			{
				EngineeringException ex4 = ex3;
				string text7 = ExtractTiaErrorDetails(ex4);
				list.Add(ExportMessage.Error(tagTableId, "TagTable", "TIA Portal error: " + ((Exception)(object)ex4).Message, text7));
				return new
				{
					success = false,
					error = text7,
					messages = list
				};
			}
			catch (Exception ex5)
			{
				list.Add(ExportMessage.Error(tagTableId, "TagTable", ex5.Message, ex5.ToString()));
				return new
				{
					success = false,
					error = ex5.Message,
					messages = list
				};
			}
		});
	}

	public void ExportTagTablesWithMessages(PlcTagTableGroup group, string exportPath, List<ExportMessage> messages, ExportCounters counters)
	{
		//IL_013d: Expected O, but got Unknown
		foreach (PlcTagTable tagTable in group.TagTables)
		{
			try
			{
				string text = tagTable.Name + ".xml";
				string text2 = Path.Combine(exportPath, text);
				if (File.Exists(text2))
				{
					string text3 = Path.Combine(Path.GetTempPath(), $"tia_compare_{Guid.NewGuid()}_{text}");
					try
					{
						tagTable.Export(new FileInfo(text3), (ExportOptions)1);
						if (XmlComparisonService.CompareXmlContent(text2, text3))
						{
							messages.Add(ExportMessage.Info(tagTable.Name, "TagTable", "No changes: " + text));
							counters.Skipped++;
						}
						else
						{
							File.Copy(text3, text2, overwrite: true);
							messages.Add(ExportMessage.Success(tagTable.Name, "TagTable", text2, "Updated: " + text));
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
					tagTable.Export(new FileInfo(text2), (ExportOptions)1);
					messages.Add(ExportMessage.Success(tagTable.Name, "TagTable", text2, "Imported: " + text));
					counters.Success++;
				}
			}
			catch (EngineeringException ex)
			{
				EngineeringException ex2 = ex;
				string details = ExtractTiaErrorDetails(ex2);
				messages.Add(ExportMessage.Error(tagTable.Name, "TagTable", "TIA Portal error importing tag table: " + tagTable.Name, details));
				counters.Error++;
			}
			catch (Exception ex3)
			{
				messages.Add(ExportMessage.Error(tagTable.Name, "TagTable", "Error importing tag table: " + tagTable.Name, ex3.Message));
				counters.Error++;
			}
		}
		foreach (PlcTagTableUserGroup group2 in group.Groups)
		{
			string text4 = Path.Combine(exportPath, group2.Name);
			Directory.CreateDirectory(text4);
			ExportTagTablesWithMessages((PlcTagTableGroup)(object)group2, text4, messages, counters);
		}
		if (!Directory.Exists(exportPath))
		{
			return;
		}
		try
		{
			HashSet<string> hashSet = new HashSet<string>(((IEnumerable<PlcTagTable>)group.TagTables).Select((PlcTagTable t) => t.Name), StringComparer.OrdinalIgnoreCase);
			string[] files = Directory.GetFiles(exportPath, "*.xml");
			foreach (string path in files)
			{
				string fileNameWithoutExtension = Path.GetFileNameWithoutExtension(path);
				if (!hashSet.Contains(fileNameWithoutExtension))
				{
					try
					{
						File.Delete(path);
						messages.Add(ExportMessage.Deleted(fileNameWithoutExtension, "TagTable", "Deleted orphaned file: " + fileNameWithoutExtension + ".xml"));
					}
					catch (Exception ex4)
					{
						messages.Add(ExportMessage.Warning(fileNameWithoutExtension, "TagTable", "Failed to delete orphaned file: " + fileNameWithoutExtension + ".xml", ex4.Message));
					}
				}
			}
			HashSet<string> hashSet2 = new HashSet<string>(((IEnumerable<PlcTagTableUserGroup>)group.Groups).Select((PlcTagTableUserGroup g) => g.Name), StringComparer.OrdinalIgnoreCase);
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
			messages.Add(ExportMessage.Warning("OrphanCleanup", "TagTable", "Failed to check for orphaned items in: " + exportPath, ex6.Message));
		}
	}

	public void ExportTagTablesRecursively(PlcTagTableGroup group, string exportPath, ref int exportedCount)
	{
		List<ExportMessage> messages = new List<ExportMessage>();
		ExportCounters exportCounters = new ExportCounters
		{
			Success = exportedCount
		};
		ExportTagTablesWithMessages(group, exportPath, messages, exportCounters);
		exportedCount = exportCounters.Success;
	}

	public PlcTagTableGroup? FindTagTableGroupByName(PlcTagTableGroup group, string groupName)
	{
		if (group.Name == groupName)
		{
			return group;
		}
		foreach (PlcTagTableUserGroup group2 in group.Groups)
		{
			if (group2.Name == groupName)
			{
				return (PlcTagTableGroup?)(object)group2;
			}
			PlcTagTableGroup val = FindTagTableGroupByName((PlcTagTableGroup)(object)group2, groupName);
			if (val != null)
			{
				return val;
			}
		}
		return null;
	}

	public (PlcTagTable? table, string path) FindTagTableByIdWithPath(PlcTagTableGroup group, string tagTableId, string currentPath = "")
	{
		string text = tagTableId;
		int num = tagTableId.IndexOf("PLC tags/", StringComparison.OrdinalIgnoreCase);
		if (num >= 0)
		{
			text = tagTableId.Substring(num + "PLC tags/".Length);
		}
		string[] array = text.Split(new char[2] { '/', '\\' }, StringSplitOptions.RemoveEmptyEntries);
		string tableName = ((array.Length != 0) ? array[array.Length - 1] : tagTableId);
		string targetGroupPath = ((array.Length > 1) ? string.Join("/", array.Take(array.Length - 1)) : "");
		return FindTagTableByNameAndPath(group, tableName, targetGroupPath, currentPath);
	}

	private (PlcTagTable? table, string path) FindTagTableByNameAndPath(PlcTagTableGroup group, string tableName, string targetGroupPath, string currentPath)
	{
		string text = currentPath.Replace('\\', '/');
		string value = targetGroupPath.Replace('\\', '/');
		if (text.Equals(value, StringComparison.OrdinalIgnoreCase))
		{
			foreach (PlcTagTable tagTable in group.TagTables)
			{
				if (tagTable.Name.Equals(tableName, StringComparison.OrdinalIgnoreCase))
				{
					return (table: tagTable, path: currentPath);
				}
			}
		}
		foreach (PlcTagTableUserGroup group2 in group.Groups)
		{
			string currentPath2 = (string.IsNullOrEmpty(currentPath) ? group2.Name : Path.Combine(currentPath, group2.Name));
			var (val, item) = FindTagTableByNameAndPath((PlcTagTableGroup)(object)group2, tableName, targetGroupPath, currentPath2);
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

