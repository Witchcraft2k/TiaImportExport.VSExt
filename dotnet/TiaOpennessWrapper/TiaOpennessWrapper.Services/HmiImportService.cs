using System;
using System.Collections.Generic;
using System.IO;
using System.Reflection;
using System.Threading.Tasks;
using Siemens.Engineering;
using Siemens.Engineering.HW;
using Siemens.Engineering.HW.Features;
using Siemens.Engineering.Hmi;
using Siemens.Engineering.Hmi.Communication;
using Siemens.Engineering.Hmi.Screen;
using Siemens.Engineering.Hmi.Tag;
using Siemens.Engineering.HmiUnified;
using Siemens.Engineering.HmiUnified.HmiConnections;
using Siemens.Engineering.HmiUnified.HmiTags;
using Siemens.Engineering.HmiUnified.UI.Base;
using Siemens.Engineering.HmiUnified.UI.ScreenGroup;
using Siemens.Engineering.HmiUnified.UI.Screens;
using TiaOpennessWrapper.Models;

namespace TiaOpennessWrapper.Services;

public class HmiImportService
{
	private readonly IDeviceLocator _devices;

	public HmiImportService(IDeviceLocator devices)
	{
		_devices = devices ?? throw new ArgumentNullException("devices");
	}

	private HmiTarget? GetHmiTarget(Device device)
	{
		foreach (DeviceItem deviceItem in ((HardwareObject)device).DeviceItems)
		{
			HmiTarget hmiTargetFromItem = GetHmiTargetFromItem(deviceItem);
			if (hmiTargetFromItem != null)
			{
				return hmiTargetFromItem;
			}
		}
		return null;
	}

	private HmiTarget? GetHmiTargetFromItem(DeviceItem item)
	{
		try
		{
			SoftwareContainer service = item.GetService<SoftwareContainer>();
			Software obj = ((service != null) ? service.Software : null);
			HmiTarget val = (HmiTarget)(object)((obj is HmiTarget) ? obj : null);
			if (val != null)
			{
				return val;
			}
		}
		catch
		{
		}
		foreach (DeviceItem deviceItem in ((HardwareObject)item).DeviceItems)
		{
			HmiTarget hmiTargetFromItem = GetHmiTargetFromItem(deviceItem);
			if (hmiTargetFromItem != null)
			{
				return hmiTargetFromItem;
			}
		}
		return null;
	}

	private HmiSoftware? GetHmiSoftware(Device device)
	{
		foreach (DeviceItem deviceItem in ((HardwareObject)device).DeviceItems)
		{
			HmiSoftware hmiSoftwareFromItem = GetHmiSoftwareFromItem(deviceItem);
			if (hmiSoftwareFromItem != null)
			{
				return hmiSoftwareFromItem;
			}
		}
		return null;
	}

	private HmiSoftware? GetHmiSoftwareFromItem(DeviceItem item)
	{
		try
		{
			SoftwareContainer service = item.GetService<SoftwareContainer>();
			Software obj = ((service != null) ? service.Software : null);
			HmiSoftware val = (HmiSoftware)(object)((obj is HmiSoftware) ? obj : null);
			if (val != null)
			{
				return val;
			}
		}
		catch
		{
		}
		foreach (DeviceItem deviceItem in ((HardwareObject)item).DeviceItems)
		{
			HmiSoftware hmiSoftwareFromItem = GetHmiSoftwareFromItem(deviceItem);
			if (hmiSoftwareFromItem != null)
			{
				return hmiSoftwareFromItem;
			}
		}
		return null;
	}

	public async Task<object> ExportHmiScreensAsync(ProjectBase? currentProject, string deviceId, string exportPath, TiaExportOptions options)
	{
		return await Task.Run(delegate
		{
			List<ExportMessage> list = new List<ExportMessage>();
			int successCount = 0;
			int errorCount = 0;
			int skippedCount = 0;
			try
			{
				if (currentProject == null)
				{
					return new
					{
						success = false,
						error = "No project selected",
						messages = new List<ExportMessage>()
					};
				}
				Device val = _devices.FindDevice(deviceId);
				if (val == null)
				{
					return new
					{
						success = false,
						error = "Device not found",
						messages = new List<ExportMessage>()
					};
				}
				HmiTarget hmiTarget = GetHmiTarget(val);
				if (hmiTarget != null)
				{
					return ExportClassicHmiScreens(hmiTarget, exportPath, options, list, ref successCount, ref errorCount, ref skippedCount);
				}
				HmiSoftware hmiSoftware = GetHmiSoftware(val);
				if (hmiSoftware != null)
				{
					return ExportUnifiedHmiScreens(hmiSoftware, exportPath, options, list, ref successCount, ref errorCount, ref skippedCount);
				}
				return new
				{
					success = false,
					error = "No HMI software found in device",
					messages = new List<ExportMessage>()
				};
			}
			catch (Exception ex)
			{
				list.Add(ExportMessage.Error("ImportHmiScreens", "Operation", ex.Message, ex.ToString()));
				return new
				{
					success = false,
					error = ex.Message,
					messages = list
				};
			}
		});
	}

	private object ExportClassicHmiScreens(HmiTarget hmiTarget, string exportPath, TiaExportOptions options, List<ExportMessage> messages, ref int successCount, ref int errorCount, ref int skippedCount)
	{
		string text = Path.Combine(exportPath, "Screens");
		Directory.CreateDirectory(text);
		ExportScreenFolder((ScreenFolder)(object)hmiTarget.ScreenFolder, text, options, messages, ref successCount, ref errorCount, ref skippedCount);
		return new
		{
			success = true,
			itemCount = successCount,
			successCount = successCount,
			errorCount = errorCount,
			skippedCount = skippedCount,
			messages = messages
		};
	}

	private void ExportScreenFolder(ScreenFolder folder, string exportPath, TiaExportOptions options, List<ExportMessage> messages, ref int successCount, ref int errorCount, ref int skippedCount)
	{
		Directory.CreateDirectory(exportPath);
		foreach (Screen screen in folder.Screens)
		{
			ExportScreen(screen, exportPath, options, messages, ref successCount, ref errorCount, ref skippedCount);
		}
		foreach (ScreenUserFolder folder2 in folder.Folders)
		{
			string exportPath2 = Path.Combine(exportPath, folder2.Name);
			ExportScreenUserFolder(folder2, exportPath2, options, messages, ref successCount, ref errorCount, ref skippedCount);
		}
	}

	private void ExportScreenUserFolder(ScreenUserFolder folder, string exportPath, TiaExportOptions options, List<ExportMessage> messages, ref int successCount, ref int errorCount, ref int skippedCount)
	{
		Directory.CreateDirectory(exportPath);
		foreach (Screen screen in folder.Screens)
		{
			ExportScreen(screen, exportPath, options, messages, ref successCount, ref errorCount, ref skippedCount);
		}
		foreach (ScreenUserFolder folder2 in folder.Folders)
		{
			string exportPath2 = Path.Combine(exportPath, folder2.Name);
			ExportScreenUserFolder(folder2, exportPath2, options, messages, ref successCount, ref errorCount, ref skippedCount);
		}
	}

	private void ExportScreen(Screen screen, string exportPath, TiaExportOptions options, List<ExportMessage> messages, ref int successCount, ref int errorCount, ref int skippedCount)
	{
		string path = screen.Name + ".xml";
		string text = Path.Combine(exportPath, path);
		try
		{
			if (File.Exists(text) && !options.OverwriteExisting)
			{
				messages.Add(ExportMessage.Info(screen.Name, "Screen", "File already exists - skipped"));
				skippedCount++;
			}
			else
			{
				screen.Export(new FileInfo(text), (ExportOptions)1);
				messages.Add(ExportMessage.Success(screen.Name, "Screen", "Exported to " + text));
				successCount++;
			}
		}
		catch (Exception ex)
		{
			messages.Add(ExportMessage.Error(screen.Name, "Screen", ex.Message, ex.ToString()));
			errorCount++;
		}
	}

	private object ExportUnifiedHmiScreens(HmiSoftware hmiSoftware, string exportPath, TiaExportOptions options, List<ExportMessage> messages, ref int successCount, ref int errorCount, ref int skippedCount)
	{
		string text = Path.Combine(exportPath, "Screens");
		Directory.CreateDirectory(text);
		try
		{
			foreach (HmiScreen screen in hmiSoftware.Screens)
			{
				ExportUnifiedScreen(screen, text, options, messages, ref successCount, ref errorCount, ref skippedCount);
			}
		}
		catch (Exception ex)
		{
			messages.Add(ExportMessage.Error("Screens", "ScreenGroup", "Error exporting screens: " + ex.Message, ex.ToString()));
		}
		try
		{
			foreach (HmiScreenGroup screenGroup in hmiSoftware.ScreenGroups)
			{
				string exportPath2 = Path.Combine(text, screenGroup.Name);
				ExportUnifiedScreenGroup(screenGroup, exportPath2, options, messages, ref successCount, ref errorCount, ref skippedCount);
			}
		}
		catch (Exception ex2)
		{
			messages.Add(ExportMessage.Error("ScreenGroups", "ScreenGroup", "Error exporting screen groups: " + ex2.Message, ex2.ToString()));
		}
		return new
		{
			success = true,
			itemCount = successCount,
			successCount = successCount,
			errorCount = errorCount,
			skippedCount = skippedCount,
			messages = messages
		};
	}

	private void ExportUnifiedScreenGroup(HmiScreenGroup screenGroup, string exportPath, TiaExportOptions options, List<ExportMessage> messages, ref int successCount, ref int errorCount, ref int skippedCount)
	{
		Directory.CreateDirectory(exportPath);
		try
		{
			foreach (HmiScreen screen in screenGroup.Screens)
			{
				ExportUnifiedScreen(screen, exportPath, options, messages, ref successCount, ref errorCount, ref skippedCount);
			}
		}
		catch (Exception ex)
		{
			messages.Add(ExportMessage.Error(screenGroup.Name, "ScreenGroup", "Error exporting screens: " + ex.Message, ex.ToString()));
		}
		try
		{
			foreach (HmiScreenGroup group in screenGroup.Groups)
			{
				string exportPath2 = Path.Combine(exportPath, group.Name);
				ExportUnifiedScreenGroup(group, exportPath2, options, messages, ref successCount, ref errorCount, ref skippedCount);
			}
		}
		catch (Exception ex2)
		{
			messages.Add(ExportMessage.Error(screenGroup.Name, "ScreenGroup", "Error exporting subgroups: " + ex2.Message, ex2.ToString()));
		}
	}

	private void ExportUnifiedScreen(HmiScreen screen, string exportPath, TiaExportOptions options, List<ExportMessage> messages, ref int successCount, ref int errorCount, ref int skippedCount)
	{
		try
		{
			DirectoryInfo directoryInfo = new DirectoryInfo(exportPath);
			if (!directoryInfo.Exists)
			{
				directoryInfo.Create();
			}
			MethodInfo method = ((object)screen).GetType().GetMethod("Export", new Type[1] { typeof(DirectoryInfo) });
			if (method != null)
			{
				method.Invoke(screen, new object[1] { directoryInfo });
				messages.Add(ExportMessage.Success(((HmiScreenBase)screen).Name, "Screen", "Exported to " + exportPath));
				successCount++;
				return;
			}
			MethodInfo method2 = ((object)screen).GetType().GetMethod("Export", new Type[2]
			{
				typeof(DirectoryInfo),
				typeof(string)
			});
			if (method2 != null)
			{
				method2.Invoke(screen, new object[2]
				{
					directoryInfo,
					((HmiScreenBase)screen).Name
				});
				messages.Add(ExportMessage.Success(((HmiScreenBase)screen).Name, "Screen", "Exported to " + exportPath));
				successCount++;
				return;
			}
			MethodInfo method3 = ((object)screen).GetType().GetMethod("Export", new Type[2]
			{
				typeof(FileInfo),
				typeof(ExportOptions)
			});
			if (method3 != null)
			{
				string text = Path.Combine(exportPath, ((HmiScreenBase)screen).Name + ".xml");
				method3.Invoke(screen, new object[2]
				{
					new FileInfo(text),
					(object)(ExportOptions)1
				});
				messages.Add(ExportMessage.Success(((HmiScreenBase)screen).Name, "Screen", "Exported to " + text));
				successCount++;
			}
			else
			{
				messages.Add(ExportMessage.Warning(((HmiScreenBase)screen).Name, "Screen", "WinCC Unified screen export not supported by this TIA Portal version - no Export method available"));
				skippedCount++;
			}
		}
		catch (Exception ex)
		{
			messages.Add(ExportMessage.Error(((HmiScreenBase)screen).Name, "Screen", ex.Message, ex.ToString()));
			errorCount++;
		}
	}

	public async Task<object> ExportHmiTagsAsync(ProjectBase? currentProject, string deviceId, string exportPath, TiaExportOptions options)
	{
		return await Task.Run(delegate
		{
			List<ExportMessage> list = new List<ExportMessage>();
			int successCount = 0;
			int errorCount = 0;
			int skippedCount = 0;
			try
			{
				if (currentProject == null)
				{
					return new
					{
						success = false,
						error = "No project selected",
						messages = new List<ExportMessage>()
					};
				}
				Device val = _devices.FindDevice(deviceId);
				if (val == null)
				{
					return new
					{
						success = false,
						error = "Device not found",
						messages = new List<ExportMessage>()
					};
				}
				HmiTarget hmiTarget = GetHmiTarget(val);
				if (hmiTarget != null)
				{
					return ExportClassicHmiTags(hmiTarget, exportPath, options, list, ref successCount, ref errorCount, ref skippedCount);
				}
				HmiSoftware hmiSoftware = GetHmiSoftware(val);
				if (hmiSoftware != null)
				{
					return ExportUnifiedHmiTags(hmiSoftware, exportPath, options, list, ref successCount, ref errorCount, ref skippedCount);
				}
				return new
				{
					success = false,
					error = "No HMI software found in device",
					messages = new List<ExportMessage>()
				};
			}
			catch (Exception ex)
			{
				list.Add(ExportMessage.Error("ImportHmiTags", "Operation", ex.Message, ex.ToString()));
				return new
				{
					success = false,
					error = ex.Message,
					messages = list
				};
			}
		});
	}

	private object ExportClassicHmiTags(HmiTarget hmiTarget, string exportPath, TiaExportOptions options, List<ExportMessage> messages, ref int successCount, ref int errorCount, ref int skippedCount)
	{
		string text = Path.Combine(exportPath, "HMI Tags");
		Directory.CreateDirectory(text);
		ExportTagFolder((TagFolder)(object)hmiTarget.TagFolder, text, options, messages, ref successCount, ref errorCount, ref skippedCount);
		return new
		{
			success = true,
			itemCount = successCount,
			successCount = successCount,
			errorCount = errorCount,
			skippedCount = skippedCount,
			messages = messages
		};
	}

	private void ExportTagFolder(TagFolder folder, string exportPath, TiaExportOptions options, List<ExportMessage> messages, ref int successCount, ref int errorCount, ref int skippedCount)
	{
		Directory.CreateDirectory(exportPath);
		foreach (TagTable tagTable in folder.TagTables)
		{
			ExportTagTable(tagTable, exportPath, options, messages, ref successCount, ref errorCount, ref skippedCount);
		}
		foreach (TagUserFolder folder2 in folder.Folders)
		{
			string exportPath2 = Path.Combine(exportPath, folder2.Name);
			ExportTagUserFolder(folder2, exportPath2, options, messages, ref successCount, ref errorCount, ref skippedCount);
		}
	}

	private void ExportTagUserFolder(TagUserFolder folder, string exportPath, TiaExportOptions options, List<ExportMessage> messages, ref int successCount, ref int errorCount, ref int skippedCount)
	{
		Directory.CreateDirectory(exportPath);
		foreach (TagTable tagTable in folder.TagTables)
		{
			ExportTagTable(tagTable, exportPath, options, messages, ref successCount, ref errorCount, ref skippedCount);
		}
		foreach (TagUserFolder folder2 in folder.Folders)
		{
			string exportPath2 = Path.Combine(exportPath, folder2.Name);
			ExportTagUserFolder(folder2, exportPath2, options, messages, ref successCount, ref errorCount, ref skippedCount);
		}
	}

	private void ExportTagTable(TagTable tagTable, string exportPath, TiaExportOptions options, List<ExportMessage> messages, ref int successCount, ref int errorCount, ref int skippedCount)
	{
		string path = tagTable.Name + ".xml";
		string text = Path.Combine(exportPath, path);
		try
		{
			if (File.Exists(text) && !options.OverwriteExisting)
			{
				messages.Add(ExportMessage.Info(tagTable.Name, "TagTable", "File already exists - skipped"));
				skippedCount++;
			}
			else
			{
				tagTable.Export(new FileInfo(text), (ExportOptions)1);
				messages.Add(ExportMessage.Success(tagTable.Name, "TagTable", "Exported to " + text));
				successCount++;
			}
		}
		catch (Exception ex)
		{
			messages.Add(ExportMessage.Error(tagTable.Name, "TagTable", ex.Message, ex.ToString()));
			errorCount++;
		}
	}

	private object ExportUnifiedHmiTags(HmiSoftware hmiSoftware, string exportPath, TiaExportOptions options, List<ExportMessage> messages, ref int successCount, ref int errorCount, ref int skippedCount)
	{
		string text = Path.Combine(exportPath, "HMI Tags");
		Directory.CreateDirectory(text);
		try
		{
			foreach (HmiTagTable tagTable in hmiSoftware.TagTables)
			{
				ExportUnifiedTagTable(tagTable, text, options, messages, ref successCount, ref errorCount, ref skippedCount);
			}
		}
		catch (Exception ex)
		{
			messages.Add(ExportMessage.Error("TagTables", "TagGroup", "Error exporting tag tables: " + ex.Message, ex.ToString()));
		}
		try
		{
			foreach (HmiTagTableGroup tagTableGroup in hmiSoftware.TagTableGroups)
			{
				string exportPath2 = Path.Combine(text, tagTableGroup.Name);
				ExportUnifiedTagTableGroup(tagTableGroup, exportPath2, options, messages, ref successCount, ref errorCount, ref skippedCount);
			}
		}
		catch (Exception ex2)
		{
			messages.Add(ExportMessage.Error("TagTableGroups", "TagGroup", "Error exporting tag table groups: " + ex2.Message, ex2.ToString()));
		}
		return new
		{
			success = true,
			itemCount = successCount,
			successCount = successCount,
			errorCount = errorCount,
			skippedCount = skippedCount,
			messages = messages
		};
	}

	private void ExportUnifiedTagTableGroup(HmiTagTableGroup tagGroup, string exportPath, TiaExportOptions options, List<ExportMessage> messages, ref int successCount, ref int errorCount, ref int skippedCount)
	{
		Directory.CreateDirectory(exportPath);
		try
		{
			foreach (HmiTagTable tagTable in tagGroup.TagTables)
			{
				ExportUnifiedTagTable(tagTable, exportPath, options, messages, ref successCount, ref errorCount, ref skippedCount);
			}
		}
		catch (Exception ex)
		{
			messages.Add(ExportMessage.Error(tagGroup.Name, "TagGroup", "Error exporting tag tables: " + ex.Message, ex.ToString()));
		}
		try
		{
			foreach (HmiTagTableGroup group in tagGroup.Groups)
			{
				string exportPath2 = Path.Combine(exportPath, group.Name);
				ExportUnifiedTagTableGroup(group, exportPath2, options, messages, ref successCount, ref errorCount, ref skippedCount);
			}
		}
		catch (Exception ex2)
		{
			messages.Add(ExportMessage.Error(tagGroup.Name, "TagGroup", "Error exporting subgroups: " + ex2.Message, ex2.ToString()));
		}
	}

	private void ExportUnifiedTagTable(HmiTagTable tagTable, string exportPath, TiaExportOptions options, List<ExportMessage> messages, ref int successCount, ref int errorCount, ref int skippedCount)
	{
		string path = tagTable.Name + ".json";
		string path2 = Path.Combine(exportPath, path);
		try
		{
			if (File.Exists(path2) && !options.OverwriteExisting)
			{
				messages.Add(ExportMessage.Info(tagTable.Name, "TagTable", "File already exists - skipped"));
				skippedCount++;
				return;
			}
			HmiTagComposition tags = tagTable.Tags;
			if (tags != null)
			{
				tags.Export(new DirectoryInfo(exportPath), tagTable.Name);
				messages.Add(ExportMessage.Success(tagTable.Name, "TagTable", "Exported to " + exportPath));
				successCount++;
			}
		}
		catch (Exception ex)
		{
			messages.Add(ExportMessage.Error(tagTable.Name, "TagTable", ex.Message, ex.ToString()));
			errorCount++;
		}
	}

	public async Task<object> ExportHmiConnectionsAsync(ProjectBase? currentProject, string deviceId, string exportPath, TiaExportOptions options)
	{
		return await Task.Run(delegate
		{
			List<ExportMessage> list = new List<ExportMessage>();
			int successCount = 0;
			int errorCount = 0;
			int skippedCount = 0;
			try
			{
				if (currentProject == null)
				{
					return new
					{
						success = false,
						error = "No project selected",
						messages = new List<ExportMessage>()
					};
				}
				Device val = _devices.FindDevice(deviceId);
				if (val == null)
				{
					return new
					{
						success = false,
						error = "Device not found",
						messages = new List<ExportMessage>()
					};
				}
				HmiTarget hmiTarget = GetHmiTarget(val);
				if (hmiTarget != null)
				{
					return ExportClassicHmiConnections(hmiTarget, exportPath, options, list, ref successCount, ref errorCount, ref skippedCount);
				}
				HmiSoftware hmiSoftware = GetHmiSoftware(val);
				if (hmiSoftware != null)
				{
					return ExportUnifiedHmiConnections(hmiSoftware, exportPath, options, list, ref successCount, ref errorCount, ref skippedCount);
				}
				return new
				{
					success = false,
					error = "No HMI software found in device",
					messages = new List<ExportMessage>()
				};
			}
			catch (Exception ex)
			{
				list.Add(ExportMessage.Error("ImportHmiConnections", "Operation", ex.Message, ex.ToString()));
				return new
				{
					success = false,
					error = ex.Message,
					messages = list
				};
			}
		});
	}

	private object ExportClassicHmiConnections(HmiTarget hmiTarget, string exportPath, TiaExportOptions options, List<ExportMessage> messages, ref int successCount, ref int errorCount, ref int skippedCount)
	{
		string text = Path.Combine(exportPath, "Connections");
		Directory.CreateDirectory(text);
		foreach (Connection connection in hmiTarget.Connections)
		{
			string path = connection.Name + ".xml";
			string text2 = Path.Combine(text, path);
			try
			{
				if (File.Exists(text2) && !options.OverwriteExisting)
				{
					messages.Add(ExportMessage.Info(connection.Name, "Connection", "File already exists - skipped"));
					skippedCount++;
				}
				else
				{
					connection.Export(new FileInfo(text2), (ExportOptions)1);
					messages.Add(ExportMessage.Success(connection.Name, "Connection", "Exported to " + text2));
					successCount++;
				}
			}
			catch (Exception ex)
			{
				messages.Add(ExportMessage.Error(connection.Name, "Connection", ex.Message, ex.ToString()));
				errorCount++;
			}
		}
		return new
		{
			success = true,
			itemCount = successCount,
			successCount = successCount,
			errorCount = errorCount,
			skippedCount = skippedCount,
			messages = messages
		};
	}

	private object ExportUnifiedHmiConnections(HmiSoftware hmiSoftware, string exportPath, TiaExportOptions options, List<ExportMessage> messages, ref int successCount, ref int errorCount, ref int skippedCount)
	{
		Directory.CreateDirectory(Path.Combine(exportPath, "Connections"));
		try
		{
			int num = 0;
			foreach (HmiConnection connection in hmiSoftware.Connections)
			{
				num++;
				messages.Add(ExportMessage.Warning(connection.Name, "Connection", "WinCC Unified connections do not support export via Openness API - use TIA Portal export function"));
				skippedCount++;
			}
			if (num == 0)
			{
				messages.Add(ExportMessage.Info("Connections", "Connection", "No connections found in WinCC Unified device"));
			}
		}
		catch (Exception ex)
		{
			messages.Add(ExportMessage.Error("Connections", "Connection", "Error accessing connections: " + ex.Message, ex.ToString()));
		}
		return new
		{
			success = true,
			itemCount = successCount,
			successCount = successCount,
			errorCount = errorCount,
			skippedCount = skippedCount,
			messages = messages
		};
	}

	public async Task<object> ExportAllHmiAsync(ProjectBase? currentProject, string deviceId, string exportPath, TiaExportOptions options)
	{
		return await Task.Run((Func<object>)delegate
		{
			List<ExportMessage> list = new List<ExportMessage>();
			int successCount = 0;
			int errorCount = 0;
			int skippedCount = 0;
			try
			{
				if (currentProject == null)
				{
					return new
					{
						success = false,
						error = "No project selected",
						messages = new List<ExportMessage>()
					};
				}
				Device val = _devices.FindDevice(deviceId);
				if (val == null)
				{
					return new
					{
						success = false,
						error = "Device not found",
						messages = new List<ExportMessage>()
					};
				}
				HmiTarget hmiTarget = GetHmiTarget(val);
				if (hmiTarget != null)
				{
					ExportClassicHmiScreens(hmiTarget, exportPath, options, list, ref successCount, ref errorCount, ref skippedCount);
					ExportClassicHmiTags(hmiTarget, exportPath, options, list, ref successCount, ref errorCount, ref skippedCount);
					ExportClassicHmiConnections(hmiTarget, exportPath, options, list, ref successCount, ref errorCount, ref skippedCount);
					return new
					{
						success = true,
						itemCount = successCount,
						successCount = successCount,
						errorCount = errorCount,
						skippedCount = skippedCount,
						messages = list
					};
				}
				HmiSoftware hmiSoftware = GetHmiSoftware(val);
				if (hmiSoftware != null)
				{
					ExportUnifiedHmiScreens(hmiSoftware, exportPath, options, list, ref successCount, ref errorCount, ref skippedCount);
					ExportUnifiedHmiTags(hmiSoftware, exportPath, options, list, ref successCount, ref errorCount, ref skippedCount);
					ExportUnifiedHmiConnections(hmiSoftware, exportPath, options, list, ref successCount, ref errorCount, ref skippedCount);
					return new
					{
						success = true,
						itemCount = successCount,
						successCount = successCount,
						errorCount = errorCount,
						skippedCount = skippedCount,
						messages = list
					};
				}
				return new
				{
					success = false,
					error = "No HMI software found in device",
					messages = new List<ExportMessage>()
				};
			}
			catch (Exception ex)
			{
				list.Add(ExportMessage.Error("ImportHmi", "Operation", ex.Message, ex.ToString()));
				return new
				{
					success = false,
					error = ex.Message,
					messages = list
				};
			}
		});
	}
}

