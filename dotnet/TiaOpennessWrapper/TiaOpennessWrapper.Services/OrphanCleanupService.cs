using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using Siemens.Engineering.HW;
using Siemens.Engineering.SW;
using Siemens.Engineering.SW.Blocks;
using Siemens.Engineering.SW.Tags;
using Siemens.Engineering.SW.Types;
using Siemens.Engineering.SW.WatchAndForceTables;
using TiaOpennessWrapper.Services.Export;
using TiaOpennessWrapper.Services.Helpers;

namespace TiaOpennessWrapper.Services;

public class OrphanCleanupService
{
	private readonly IDeviceLocator _devices;

	public OrphanCleanupService(IDeviceLocator devices)
	{
		_devices = devices ?? throw new ArgumentNullException("devices");
	}

	public async Task<object> DeleteOrphanedBlockGroupsAsync(string deviceId, string localFolderPath, string? basePath = null)
	{
		return await Task.Run((Func<object>)delegate
		{
			try
			{
				Device val = _devices.FindDevice(deviceId);
				if (val == null)
				{
					return new
					{
						success = false,
						error = "Device not found: " + deviceId
					};
				}
				PlcSoftware plcSoftware = _devices.GetPlcSoftware(val);
				if (plcSoftware == null)
				{
					return new
					{
						success = false,
						error = "No PLC software found in device: " + deviceId
					};
				}
				string text = TiaFolderFinder.FindFolder(localFolderPath, TiaFolderFinder.ProgramBlocksVariants);
				if (text == null)
				{
					return new
					{
						success = true,
						deletedGroups = new string[0],
						deletedBlocks = new string[0],
						deletedCount = 0,
						message = "No Program blocks folder found"
					};
				}
				PlcBlockGroup val2 = (PlcBlockGroup)(object)plcSoftware.BlockGroup;
				string localFolderPath2 = text;
				string text2 = localFolderPath.Replace(Path.AltDirectorySeparatorChar, Path.DirectorySeparatorChar).TrimEnd(Path.DirectorySeparatorChar);
				string text3 = text.Replace(Path.AltDirectorySeparatorChar, Path.DirectorySeparatorChar).TrimEnd(Path.DirectorySeparatorChar);
				if (text2.Length > text3.Length && text2.StartsWith(text3, StringComparison.OrdinalIgnoreCase))
				{
					string text4 = text2.Substring(text3.Length + 1);
					PlcBlockGroup val3 = TiaGroupHelper.FindBlockGroup(val2, text4);
					if (val3 == null)
					{
						return new
						{
							success = true,
							deletedGroups = new string[0],
							deletedBlocks = new string[0],
							deletedCount = 0,
							message = "Group not found in TIA: " + text4
						};
					}
					val2 = val3;
					localFolderPath2 = localFolderPath;
				}
				List<string> list = new List<string>();
				List<string> list2 = new List<string>();
				List<string> list3 = new List<string>();
				TiaGroupHelper.DeleteOrphanedBlocks(val2, localFolderPath2, list2, list3);
				TiaGroupHelper.DeleteOrphanedBlockGroups(val2, localFolderPath2, list, list3);
				return new
				{
					success = true,
					deletedGroups = list.ToArray(),
					deletedBlocks = list2.ToArray(),
					deletedCount = list.Count + list2.Count,
					errors = ((list3.Count > 0) ? list3.ToArray() : null)
				};
			}
			catch (Exception ex)
			{
				return new
				{
					success = false,
					error = ex.Message
				};
			}
		});
	}

	public async Task<object> DeleteOrphanedTagTablesAsync(string deviceId, string localFolderPath)
	{
		return await Task.Run((Func<object>)delegate
		{
			try
			{
				Device val = _devices.FindDevice(deviceId);
				if (val == null)
				{
					return new
					{
						success = false,
						error = "Device not found: " + deviceId
					};
				}
				PlcSoftware plcSoftware = _devices.GetPlcSoftware(val);
				if (plcSoftware == null)
				{
					return new
					{
						success = false,
						error = "No PLC software found in device: " + deviceId
					};
				}
				string text = TiaFolderFinder.FindFolder(localFolderPath, TiaFolderFinder.PlcTagsVariants);
				if (text == null)
				{
					return new
					{
						success = true,
						deletedGroups = new string[0],
						deletedTables = new string[0],
						deletedCount = 0,
						message = "No PLC tags folder found"
					};
				}
				List<string> list = new List<string>();
				List<string> list2 = new List<string>();
				List<string> list3 = new List<string>();
				TiaGroupHelper.DeleteOrphanedTagTableGroups((PlcTagTableGroup)(object)plcSoftware.TagTableGroup, text, list, list2, list3);
				return new
				{
					success = true,
					deletedGroups = list.ToArray(),
					deletedTables = list2.ToArray(),
					deletedCount = list.Count + list2.Count,
					errors = ((list3.Count > 0) ? list3.ToArray() : null)
				};
			}
			catch (Exception ex)
			{
				return new
				{
					success = false,
					error = ex.Message
				};
			}
		});
	}

	public async Task<object> DeleteOrphanedTypesAsync(string deviceId, string localFolderPath)
	{
		return await Task.Run((Func<object>)delegate
		{
			try
			{
				Device val = _devices.FindDevice(deviceId);
				if (val == null)
				{
					return new
					{
						success = false,
						error = "Device not found: " + deviceId
					};
				}
				PlcSoftware plcSoftware = _devices.GetPlcSoftware(val);
				if (plcSoftware == null)
				{
					return new
					{
						success = false,
						error = "No PLC software found in device: " + deviceId
					};
				}
				string text = TiaFolderFinder.FindFolder(localFolderPath, TiaFolderFinder.PlcDataTypesVariants);
				if (text == null)
				{
					return new
					{
						success = true,
						deletedGroups = new string[0],
						deletedTypes = new string[0],
						deletedCount = 0,
						message = "No PLC data types folder found"
					};
				}
				List<string> list = new List<string>();
				List<string> list2 = new List<string>();
				List<string> list3 = new List<string>();
				TiaGroupHelper.DeleteOrphanedTypeGroups((PlcTypeGroup)(object)plcSoftware.TypeGroup, text, list, list2, list3);
				return new
				{
					success = true,
					deletedGroups = list.ToArray(),
					deletedTypes = list2.ToArray(),
					deletedCount = list.Count + list2.Count,
					errors = ((list3.Count > 0) ? list3.ToArray() : null)
				};
			}
			catch (Exception ex)
			{
				return new
				{
					success = false,
					error = ex.Message
				};
			}
		});
	}

	public async Task<object> DeleteOrphanedWatchTablesAsync(string deviceId, string localFolderPath)
	{
		return await Task.Run((Func<object>)delegate
		{
			try
			{
				Device val = _devices.FindDevice(deviceId);
				if (val == null)
				{
					return new
					{
						success = false,
						error = "Device not found: " + deviceId
					};
				}
				PlcSoftware plcSoftware = _devices.GetPlcSoftware(val);
				if (plcSoftware == null)
				{
					return new
					{
						success = false,
						error = "No PLC software found in device: " + deviceId
					};
				}
				string text = TiaFolderFinder.FindFolder(localFolderPath, TiaFolderFinder.WatchTablesVariants);
				if (text == null)
				{
					return new
					{
						success = true,
						deletedTables = new string[0],
						deletedCount = 0,
						message = "No Watch and force tables folder found"
					};
				}
				List<string> list = new List<string>();
				List<string> list2 = new List<string>();
				TiaGroupHelper.DeleteOrphanedWatchTables((PlcWatchAndForceTableGroup)(object)plcSoftware.WatchAndForceTableGroup, text, list, list2);
				return new
				{
					success = true,
					deletedTables = list.ToArray(),
					deletedCount = list.Count,
					errors = ((list2.Count > 0) ? list2.ToArray() : null)
				};
			}
			catch (Exception ex)
			{
				return new
				{
					success = false,
					error = ex.Message
				};
			}
		});
	}
}
