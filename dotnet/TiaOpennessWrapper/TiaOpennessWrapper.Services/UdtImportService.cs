using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Siemens.Engineering;
using Siemens.Engineering.SW.Types;
using TiaOpennessWrapper.Models;
using TiaOpennessWrapper.Services.Export;

namespace TiaOpennessWrapper.Services;

public class UdtImportService
{
	private readonly IDeviceLocator _devices;

	public UdtImportService(IDeviceLocator devices)
	{
		_devices = devices ?? throw new ArgumentNullException("devices");
	}

	public async Task<object> ExportUserDataTypesAsync(ProjectBase? currentProject, string deviceId, string exportPath)
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
				ExportUserDataTypesWithMessages((PlcTypeGroup)(object)val.TypeGroup, exportPath, list, exportCounters);
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
				list.Add(ExportMessage.Error("ImportUserDataTypes", "Operation", ex.Message, ex.ToString()));
				return new
				{
					success = false,
					error = ex.Message,
					messages = list
				};
			}
		});
	}

	public async Task<object> ExportUdtsFromGroupAsync(ProjectBase? currentProject, string deviceId, string groupName, string groupPath, string exportPath)
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
				PlcTypeGroup val2 = FindUdtGroupByName((PlcTypeGroup)(object)val.TypeGroup, groupName);
				if (val2 == null)
				{
					return new
					{
						success = false,
						error = "UDT group '" + groupName + "' not found",
						messages = new List<ExportMessage>()
					};
				}
				string text = (string.IsNullOrEmpty(groupPath) ? exportPath : Path.Combine(exportPath, groupPath.Replace("/", Path.DirectorySeparatorChar.ToString())));
				Directory.CreateDirectory(text);
				ExportUserDataTypesWithMessages(val2, text, list, exportCounters);
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
				list.Add(ExportMessage.Error("ImportUdtsFromGroup", "Operation", ex.Message, ex.ToString()));
				return new
				{
					success = false,
					error = ex.Message,
					messages = list
				};
			}
		});
	}

	public async Task<object> ExportSingleUdtAsync(ProjectBase? currentProject, string deviceId, string udtId, string exportPath)
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
				var (val2, text) = FindUdtByIdWithPath((PlcTypeGroup)(object)val.TypeGroup, udtId);
				if (val2 == null)
				{
					return new
					{
						success = false,
						error = "UDT '" + udtId + "' not found",
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
							list.Add(ExportMessage.Info(val2.Name, "UDT", "No changes: " + text2));
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
						list.Add(ExportMessage.Success(val2.Name, "UDT", text3, "Updated: " + text2));
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
					list.Add(ExportMessage.Success(val2.Name, "UDT", text3, "Imported: " + text2));
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
				list.Add(ExportMessage.Error(udtId, "UDT", "TIA Portal error: " + ((Exception)(object)ex2).Message, text5));
				return new
				{
					success = false,
					error = text5,
					messages = list
				};
			}
			catch (Exception ex3)
			{
				list.Add(ExportMessage.Error(udtId, "UDT", ex3.Message, ex3.ToString()));
				return new
				{
					success = false,
					error = ex3.Message,
					messages = list
				};
			}
		});
	}

	public void ExportUserDataTypesWithMessages(PlcTypeGroup group, string exportPath, List<ExportMessage> messages, ExportCounters counters)
	{
		//IL_013d: Expected O, but got Unknown
		foreach (PlcType type in group.Types)
		{
			try
			{
				string text = type.Name + ".xml";
				string text2 = Path.Combine(exportPath, text);
				if (File.Exists(text2))
				{
					string text3 = Path.Combine(Path.GetTempPath(), $"tia_compare_{Guid.NewGuid()}_{text}");
					try
					{
						type.Export(new FileInfo(text3), (ExportOptions)1);
						if (XmlComparisonService.CompareXmlContent(text2, text3))
						{
							messages.Add(ExportMessage.Info(type.Name, "UDT", "No changes: " + text));
							counters.Skipped++;
						}
						else
						{
							File.Copy(text3, text2, overwrite: true);
							messages.Add(ExportMessage.Success(type.Name, "UDT", text2, "Updated: " + text));
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
					type.Export(new FileInfo(text2), (ExportOptions)1);
					messages.Add(ExportMessage.Success(type.Name, "UDT", text2, "Imported: " + text));
					counters.Success++;
				}
			}
			catch (EngineeringException ex)
			{
				EngineeringException ex2 = ex;
				string details = ExtractTiaErrorDetails(ex2);
				messages.Add(ExportMessage.Error(type.Name, "UDT", "TIA Portal error importing UDT: " + type.Name, details));
				counters.Error++;
			}
			catch (Exception ex3)
			{
				messages.Add(ExportMessage.Error(type.Name, "UDT", "Error importing UDT: " + type.Name, ex3.Message));
				counters.Error++;
			}
		}
		foreach (PlcTypeUserGroup group2 in group.Groups)
		{
			string text4 = Path.Combine(exportPath, group2.Name);
			Directory.CreateDirectory(text4);
			ExportUserDataTypesWithMessages((PlcTypeGroup)(object)group2, text4, messages, counters);
		}
		if (!Directory.Exists(exportPath))
		{
			return;
		}
		try
		{
			HashSet<string> hashSet = new HashSet<string>(((IEnumerable<PlcType>)group.Types).Select((PlcType t) => t.Name), StringComparer.OrdinalIgnoreCase);
			string[] files = Directory.GetFiles(exportPath, "*.xml");
			foreach (string path in files)
			{
				string fileNameWithoutExtension = Path.GetFileNameWithoutExtension(path);
				if (!hashSet.Contains(fileNameWithoutExtension))
				{
					try
					{
						File.Delete(path);
						messages.Add(ExportMessage.Deleted(fileNameWithoutExtension, "UDT", "Deleted orphaned file: " + fileNameWithoutExtension + ".xml"));
					}
					catch (Exception ex4)
					{
						messages.Add(ExportMessage.Warning(fileNameWithoutExtension, "UDT", "Failed to delete orphaned file: " + fileNameWithoutExtension + ".xml", ex4.Message));
					}
				}
			}
			HashSet<string> hashSet2 = new HashSet<string>(((IEnumerable<PlcTypeUserGroup>)group.Groups).Select((PlcTypeUserGroup g) => g.Name), StringComparer.OrdinalIgnoreCase);
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
			messages.Add(ExportMessage.Warning("OrphanCleanup", "UDT", "Failed to check for orphaned items in: " + exportPath, ex6.Message));
		}
	}

	public void ExportUserDataTypesRecursively(PlcTypeGroup group, string exportPath, ref int exportedCount)
	{
		List<ExportMessage> messages = new List<ExportMessage>();
		ExportCounters exportCounters = new ExportCounters
		{
			Success = exportedCount
		};
		ExportUserDataTypesWithMessages(group, exportPath, messages, exportCounters);
		exportedCount = exportCounters.Success;
	}

	public PlcTypeGroup? FindUdtGroupByName(PlcTypeGroup group, string groupName)
	{
		if (group.Name == groupName)
		{
			return group;
		}
		foreach (PlcTypeUserGroup group2 in group.Groups)
		{
			if (group2.Name == groupName)
			{
				return (PlcTypeGroup?)(object)group2;
			}
			PlcTypeGroup val = FindUdtGroupByName((PlcTypeGroup)(object)group2, groupName);
			if (val != null)
			{
				return val;
			}
		}
		return null;
	}

	public (PlcType? udt, string path) FindUdtByIdWithPath(PlcTypeGroup group, string udtId, string currentPath = "")
	{
		string text = udtId;
		int num = udtId.IndexOf("PLC data types/", StringComparison.OrdinalIgnoreCase);
		if (num >= 0)
		{
			text = udtId.Substring(num + "PLC data types/".Length);
		}
		string[] array = text.Split(new char[2] { '/', '\\' }, StringSplitOptions.RemoveEmptyEntries);
		string udtName = ((array.Length != 0) ? array[array.Length - 1] : udtId);
		string targetGroupPath = ((array.Length > 1) ? string.Join("/", array.Take(array.Length - 1)) : "");
		return FindUdtByNameAndPath(group, udtName, targetGroupPath, currentPath);
	}

	private (PlcType? udt, string path) FindUdtByNameAndPath(PlcTypeGroup group, string udtName, string targetGroupPath, string currentPath)
	{
		string text = currentPath.Replace('\\', '/');
		string value = targetGroupPath.Replace('\\', '/');
		if (text.Equals(value, StringComparison.OrdinalIgnoreCase))
		{
			foreach (PlcType type in group.Types)
			{
				if (type.Name.Equals(udtName, StringComparison.OrdinalIgnoreCase))
				{
					return (udt: type, path: currentPath);
				}
			}
		}
		foreach (PlcTypeUserGroup group2 in group.Groups)
		{
			string currentPath2 = (string.IsNullOrEmpty(currentPath) ? group2.Name : Path.Combine(currentPath, group2.Name));
			var (val, item) = FindUdtByNameAndPath((PlcTypeGroup)(object)group2, udtName, targetGroupPath, currentPath2);
			if (val != null)
			{
				return (udt: val, path: item);
			}
		}
		return (udt: null, path: "");
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

