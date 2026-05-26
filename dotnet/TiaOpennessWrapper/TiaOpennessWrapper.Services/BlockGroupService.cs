using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Siemens.Engineering;
using Siemens.Engineering.HW;
using Siemens.Engineering.SW;
using Siemens.Engineering.SW.Blocks;
using TiaOpennessWrapper.Models;
using TiaOpennessWrapper.Services.Export;

namespace TiaOpennessWrapper.Services;

public class BlockGroupService
{
	private readonly IDeviceLocator _devices;

	public BlockGroupService(IDeviceLocator devices)
	{
		_devices = devices ?? throw new ArgumentNullException("devices");
	}

	public async Task<object> CreateBlockGroupsAsync(string deviceId, string[] groupPaths, string? basePath = null)
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
				List<string> list = new List<string>();
				List<string> list2 = new List<string>();
				string[] array = groupPaths;
				foreach (string text in array)
				{
					try
					{
						string text2 = text;
						if (!string.IsNullOrEmpty(basePath))
						{
							string text3 = basePath.Replace("/", "\\").TrimEnd('\\');
							string text4 = text.Replace("/", "\\").TrimEnd('\\');
							if (text4.StartsWith(text3, StringComparison.OrdinalIgnoreCase))
							{
								text2 = text4.Substring(text3.Length).TrimStart('\\');
							}
						}
						if (!string.IsNullOrEmpty(text2))
						{
							TiaGroupHelper.GetOrCreateBlockGroup((PlcBlockGroup)(object)plcSoftware.BlockGroup, text2);
							list.Add(text2);
						}
					}
					catch (Exception ex)
					{
						list2.Add(text + ": " + ex.Message);
					}
				}
				return new
				{
					success = true,
					createdGroups = list.ToArray(),
					groupsCount = list.Count,
					errors = ((list2.Count > 0) ? list2.ToArray() : null)
				};
			}
			catch (Exception ex2)
			{
				return new
				{
					success = false,
					error = ex2.Message
				};
			}
		});
	}

	public async Task<object> CreateInstanceDBAsync(ProjectBase? currentProject, string deviceId, string instanceDbName, string instanceOfName, int blockNumber = 0, string? groupPath = null)
	{
		return await Task.Run((Func<object>)delegate
		{
			//IL_01a1: Expected O, but got Unknown
			List<ExportMessage> list = new List<ExportMessage>();
			try
			{
				if (currentProject == null)
				{
					return new
					{
						success = false,
						error = "No project selected",
						messages = list
					};
				}
				Device val = _devices.FindDevice(deviceId);
				if (val == null)
				{
					return new
					{
						success = false,
						error = "Device not found: " + deviceId,
						messages = list
					};
				}
				PlcSoftware plcSoftware = _devices.GetPlcSoftware(val);
				if (plcSoftware == null)
				{
					return new
					{
						success = false,
						error = "PLC software not found",
						messages = list
					};
				}
				PlcBlockGroup val2 = (PlcBlockGroup)(object)plcSoftware.BlockGroup;
				string text = "";
				if (!string.IsNullOrEmpty(groupPath))
				{
					val2 = TiaGroupHelper.GetOrCreateBlockGroup((PlcBlockGroup)(object)plcSoftware.BlockGroup, groupPath);
					text = " (group: " + groupPath + ")";
				}
				if (TiaGroupHelper.FindBlockByName(val2, instanceDbName) != null)
				{
					list.Add(ExportMessage.Info(instanceDbName, "InstanceDB", "Instance DB '" + instanceDbName + "' already exists - skipped"));
					return new
					{
						success = true,
						skipped = true,
						messages = list
					};
				}
				bool flag = blockNumber == 0;
				val2.Blocks.CreateInstanceDB(instanceDbName, flag, blockNumber, instanceOfName);
				list.Add(ExportMessage.Success(instanceDbName, "InstanceDB", "Created Instance DB '" + instanceDbName + "' (instance of '" + instanceOfName + "') in " + plcSoftware.Name + text));
				return new
				{
					success = true,
					messages = list
				};
			}
			catch (EngineeringException ex)
			{
				string text2 = ErrorHelper.ExtractFullErrorMessage((Exception)ex);
				list.Add(ExportMessage.Error(instanceDbName, "InstanceDB", "Failed to create Instance DB", text2));
				return new
				{
					success = false,
					error = text2,
					messages = list
				};
			}
			catch (Exception ex2)
			{
				string text3 = ErrorHelper.ExtractFullErrorMessage(ex2);
				list.Add(ExportMessage.Error(instanceDbName, "InstanceDB", "Failed to create Instance DB", text3));
				return new
				{
					success = false,
					error = text3,
					messages = list
				};
			}
		});
	}
}

