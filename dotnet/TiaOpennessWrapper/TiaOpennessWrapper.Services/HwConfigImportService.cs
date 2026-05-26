using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Xml;
using Siemens.Engineering;
using Siemens.Engineering.HW;
using TiaOpennessWrapper.Models;
using TiaOpennessWrapper.Services.HW.Cax;
using TiaOpennessWrapper.Services.Import;

namespace TiaOpennessWrapper.Services;

public class HwConfigImportService
{
	public async Task<object> ImportHwConfigAsync(ProjectBase? currentProject, HwConfigImportOptions options)
	{
		return await Task.Run((Func<object>)delegate
		{
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
				TiaHwConfigInfo tiaHwConfigInfo = new TiaHwConfigInfo
				{
					ProjectName = ((ProjectBase)currentProject).Name,
					Devices = new List<TiaHwDeviceInfo>(),
					Subnets = new List<TiaSubnetInfo>()
				};
				HashSet<string> hashSet = new HashSet<string>();
				foreach (Device device in ((ProjectBase)currentProject).Devices)
				{
					try
					{
						string deviceDisplayName = DeviceItemHelper.GetDeviceDisplayName(device);
						TiaHwDeviceInfo tiaHwDeviceInfo = DeviceImportHelper.ImportDeviceConfig(device, options, list);
						if (tiaHwDeviceInfo != null)
						{
							tiaHwConfigInfo.Devices.Add(tiaHwDeviceInfo);
							hashSet.Add(((HardwareObject)device).Name);
							list.Add(ExportMessage.Success(deviceDisplayName, "Device", "Imported HW config for device: " + deviceDisplayName));
						}
					}
					catch (Exception ex)
					{
						string deviceDisplayName2 = DeviceItemHelper.GetDeviceDisplayName(device);
						list.Add(ExportMessage.Error(deviceDisplayName2, "Device", "Error importing device config: " + ex.Message));
					}
				}
				try
				{
					foreach (Device device2 in ((DeviceGroup)((ProjectBase)currentProject).UngroupedDevicesGroup).Devices)
					{
						if (!hashSet.Contains(((HardwareObject)device2).Name))
						{
							try
							{
								string deviceDisplayName3 = DeviceItemHelper.GetDeviceDisplayName(device2);
								TiaHwDeviceInfo tiaHwDeviceInfo2 = DeviceImportHelper.ImportDeviceConfig(device2, options, list);
								if (tiaHwDeviceInfo2 != null)
								{
									tiaHwConfigInfo.Devices.Add(tiaHwDeviceInfo2);
									hashSet.Add(((HardwareObject)device2).Name);
									list.Add(ExportMessage.Success(deviceDisplayName3, "Device", "Imported HW config for ungrouped device: " + deviceDisplayName3));
								}
							}
							catch (Exception ex2)
							{
								string deviceDisplayName4 = DeviceItemHelper.GetDeviceDisplayName(device2);
								list.Add(ExportMessage.Warning(deviceDisplayName4, "Device", "Error importing ungrouped device: " + ex2.Message));
							}
						}
					}
				}
				catch (Exception ex3)
				{
					list.Add(ExportMessage.Info("UngroupedDevices", "Device", "Could not access ungrouped devices: " + ex3.Message));
				}
				if (options.IncludeSubnets)
				{
					try
					{
						tiaHwConfigInfo.Subnets = NetworkImportHelper.ImportSubnets(currentProject, list);
					}
					catch (Exception ex4)
					{
						list.Add(ExportMessage.Warning("Subnets", "Network", "Could not import subnets: " + ex4.Message));
					}
				}
				if (options.ExportToXml && !string.IsNullOrEmpty(options.ExportPath))
				{
					try
					{
						if (HwConfigFormat.Normalize(options.Format) == "cax")
						{
							ExportHwConfigToCax(currentProject, options.ExportPath, list);
						}
						else
						{
							ExportHwConfigToXml(currentProject, options.ExportPath, list);
						}
					}
					catch (Exception ex5)
					{
						list.Add(ExportMessage.Warning("Export", "Export", "Could not export HW config: " + ex5.Message));
					}
				}
				return new
				{
					success = true,
					hwConfig = tiaHwConfigInfo,
					deviceCount = tiaHwConfigInfo.Devices.Count,
					subnetCount = tiaHwConfigInfo.Subnets.Count,
					messages = list
				};
			}
			catch (Exception ex6)
			{
				list.Add(ExportMessage.Error("HwConfigImport", "Operation", ex6.Message, ex6.ToString()));
				return new
				{
					success = false,
					error = ex6.Message,
					messages = list
				};
			}
		});
	}

	public async Task<object> ImportDeviceHwConfigAsync(ProjectBase? currentProject, string deviceName, HwConfigImportOptions options)
	{
		return await Task.Run((Func<object>)delegate
		{
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
				Device val = ((IEnumerable<Device>)((ProjectBase)currentProject).Devices).FirstOrDefault((Device d) => DeviceItemHelper.GetDeviceDisplayName(d) == deviceName || ((HardwareObject)d).Name == deviceName);
				if (val == null)
				{
					try
					{
						DeviceSystemGroup ungroupedDevicesGroup = ((ProjectBase)currentProject).UngroupedDevicesGroup;
						val = ((ungroupedDevicesGroup == null) ? null : ((IEnumerable<Device>)((DeviceGroup)ungroupedDevicesGroup).Devices)?.FirstOrDefault((Device d) => DeviceItemHelper.GetDeviceDisplayName(d) == deviceName || ((HardwareObject)d).Name == deviceName));
					}
					catch
					{
					}
				}
				if (val == null)
				{
					return new
					{
						success = false,
						error = "Device '" + deviceName + "' not found",
						messages = list
					};
				}
				string deviceDisplayName = DeviceItemHelper.GetDeviceDisplayName(val);
				TiaHwDeviceInfo tiaHwDeviceInfo = DeviceImportHelper.ImportDeviceConfig(val, options, list);
				if (tiaHwDeviceInfo == null)
				{
					return new
					{
						success = false,
						error = "Could not import device configuration",
						messages = list
					};
				}
				list.Add(ExportMessage.Success(deviceDisplayName, "Device", "Imported HW config for device: " + deviceDisplayName));
				if (options.ExportToXml && !string.IsNullOrEmpty(options.ExportPath))
				{
					try
					{
						if (HwConfigFormat.Normalize(options.Format) == "cax")
						{
							ExportDeviceToCax(val, options.ExportPath, list);
						}
						else
						{
							ExportDeviceToXml(val, options.ExportPath, list);
						}
					}
					catch (Exception ex)
					{
						list.Add(ExportMessage.Warning("Export", "Export", "Could not export HW config: " + ex.Message));
					}
				}
				return new
				{
					success = true,
					device = tiaHwDeviceInfo,
					messages = list
				};
			}
			catch (Exception ex2)
			{
				list.Add(ExportMessage.Error("DeviceHwConfigImport", "Operation", ex2.Message, ex2.ToString()));
				return new
				{
					success = false,
					error = ex2.Message,
					messages = list
				};
			}
		});
	}

	private void ExportHwConfigToXml(ProjectBase project, string exportPath, List<ExportMessage> messages)
	{
		Directory.CreateDirectory(exportPath);
		HashSet<string> hashSet = new HashSet<string>();
		messages.Add(ExportMessage.Info("Export", "Start", "Starting XML export to: " + exportPath));
		messages.Add(ExportMessage.Info("Export", "Devices", $"Project.Devices count: {((ProjectBase)project).Devices.Count}"));
		foreach (Device device in ((ProjectBase)project).Devices)
		{
			messages.Add(ExportMessage.Info(((HardwareObject)device).Name, "Device", "Exporting main device: " + ((HardwareObject)device).Name));
			ExportDeviceToXml(device, exportPath, messages);
			hashSet.Add(((HardwareObject)device).Name);
		}
		try
		{
			DeviceSystemGroup ungroupedDevicesGroup = ((ProjectBase)project).UngroupedDevicesGroup;
			int? obj;
			if (ungroupedDevicesGroup == null)
			{
				obj = null;
			}
			else
			{
				DeviceComposition devices = ((DeviceGroup)ungroupedDevicesGroup).Devices;
				obj = ((devices != null) ? new int?(devices.Count) : ((int?)null));
			}
			int? num = obj;
			int valueOrDefault = num.GetValueOrDefault();
			messages.Add(ExportMessage.Info("Export", "UngroupedDevices", $"UngroupedDevicesGroup.Devices count: {valueOrDefault}"));
			DeviceSystemGroup ungroupedDevicesGroup2 = ((ProjectBase)project).UngroupedDevicesGroup;
			if (((ungroupedDevicesGroup2 != null) ? ((DeviceGroup)ungroupedDevicesGroup2).Devices : null) != null)
			{
				foreach (Device device2 in ((DeviceGroup)((ProjectBase)project).UngroupedDevicesGroup).Devices)
				{
					messages.Add(ExportMessage.Info(((HardwareObject)device2).Name, "Device", "Found ungrouped device: " + ((HardwareObject)device2).Name));
					if (!hashSet.Contains(((HardwareObject)device2).Name))
					{
						ExportDeviceToXml(device2, exportPath, messages);
						hashSet.Add(((HardwareObject)device2).Name);
					}
				}
			}
		}
		catch (Exception ex)
		{
			messages.Add(ExportMessage.Warning("UngroupedDevices", "Export", "Could not export ungrouped devices: " + ex.Message));
		}
		try
		{
			messages.Add(ExportMessage.Info("Export", "Subnets", $"Checking subnets for additional devices. Subnet count: {((ProjectBase)project).Subnets.Count}"));
			foreach (Subnet subnet in ((ProjectBase)project).Subnets)
			{
				messages.Add(ExportMessage.Info(subnet.Name, "Subnet", $"Checking subnet: {subnet.Name}, nodes: {subnet.Nodes.Count}"));
				foreach (Node node in subnet.Nodes)
				{
					try
					{
						object attribute = node.GetAttribute("Device");
						Device val = (Device)((attribute is Device) ? attribute : null);
						if (val != null && !hashSet.Contains(((HardwareObject)val).Name))
						{
							messages.Add(ExportMessage.Info(((HardwareObject)val).Name, "Device", "Found device from subnet node: " + ((HardwareObject)val).Name));
							ExportDeviceToXml(val, exportPath, messages);
							hashSet.Add(((HardwareObject)val).Name);
						}
					}
					catch
					{
					}
				}
			}
		}
		catch (Exception ex2)
		{
			messages.Add(ExportMessage.Warning("Subnets", "Export", "Could not export subnet devices: " + ex2.Message));
		}
	}

	private string GetDeviceCategoryFolder(Device device)
	{
		return DeviceItemHelper.GetDeviceType(device) switch
		{
			"PLC" => "PLCs", 
			"HMI" => "HMIs", 
			"DistributedIO" => "IO_Devices", 
			"Drive" => "IO_Devices", 
			"Device" => "IO_Devices", 
			_ => "IO_Devices", 
		};
	}

	private void ExportDeviceToXml(Device device, string exportPath, List<ExportMessage> messages)
	{
		try
		{
			string deviceDisplayName = DeviceItemHelper.GetDeviceDisplayName(device);
			string text = DeviceItemHelper.SanitizeFileName(deviceDisplayName);
			string text2 = exportPath.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
			string path = text + "_HwConfig.xml";
			string fileName = Path.GetFileName(text2);
			string deviceCategoryFolder = GetDeviceCategoryFolder(device);
			string text3 = ((text2.EndsWith("DeviceConfiguration", StringComparison.OrdinalIgnoreCase) || string.Equals(fileName, text, StringComparison.OrdinalIgnoreCase)) ? text2 : ((deviceCategoryFolder == "IO_Devices" && string.Equals(fileName, "IO_Devices", StringComparison.OrdinalIgnoreCase)) ? text2 : ((!(deviceCategoryFolder == "IO_Devices")) ? Path.Combine(text2, deviceCategoryFolder, text, "DeviceConfiguration") : Path.Combine(text2, deviceCategoryFolder))));
			Directory.CreateDirectory(text3);
			string text4 = Path.Combine(text3, path);
			messages.Add(ExportMessage.Info(deviceDisplayName, "Export", "Starting export to: " + text4));
			using (XmlTextWriter xmlTextWriter = new XmlTextWriter(text4, Encoding.UTF8))
			{
				xmlTextWriter.Formatting = Formatting.Indented;
				xmlTextWriter.WriteStartDocument();
				xmlTextWriter.WriteStartElement("DeviceConfiguration");
				xmlTextWriter.WriteAttributeString("xmlns", "http://www.siemens.com/automation/Openness/HW");
				xmlTextWriter.WriteStartElement("Device");
				xmlTextWriter.WriteAttributeString("Name", deviceDisplayName);
				xmlTextWriter.WriteAttributeString("FullName", ((HardwareObject)device).Name);
				xmlTextWriter.WriteAttributeString("TypeIdentifier", DeviceItemHelper.GetDeviceTypeIdentifier(device));
				xmlTextWriter.WriteStartElement("DeviceItems");
				XmlImportWriter.ExportDeviceItemsToXml(((HardwareObject)device).DeviceItems, xmlTextWriter, 0, messages);
				xmlTextWriter.WriteEndElement();
				xmlTextWriter.WriteEndElement();
				xmlTextWriter.WriteEndElement();
				xmlTextWriter.WriteEndDocument();
			}
			messages.Add(ExportMessage.Success(((HardwareObject)device).Name, "Device", "Imported HW config to: " + text4));
		}
		catch (Exception ex)
		{
			messages.Add(ExportMessage.Error(((HardwareObject)device).Name, "Device", "Failed to import device XML: " + ex.Message));
		}
	}

	private void ExportHwConfigToCax(ProjectBase project, string exportPath, List<ExportMessage> messages)
	{
		Directory.CreateDirectory(exportPath);
		messages.Add(ExportMessage.Info("Export", "Start", "Starting CAx export to: " + exportPath));
		CaxOperationResult caxOperationResult = new HwConfigCaxService().ExportProject(project, exportPath, messages);
		if (caxOperationResult.Success)
		{
			return;
		}
		messages.Add(ExportMessage.Warning("Export", "CAx", "Project-level CAx export failed (" + caxOperationResult.Error + "); falling back to per-device CAx export."));
		foreach (Device device in project.Devices)
		{
			ExportDeviceToCax(device, exportPath, messages);
		}
	}

	private void ExportDeviceToCax(Device device, string exportPath, List<ExportMessage> messages)
	{
		try
		{
			string text = DeviceItemHelper.SanitizeFileName(DeviceItemHelper.GetDeviceDisplayName(device));
			string text2 = exportPath.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
			string fileName = Path.GetFileName(text2);
			string deviceCategoryFolder = GetDeviceCategoryFolder(device);
			string text3 = ((text2.EndsWith("DeviceConfiguration", StringComparison.OrdinalIgnoreCase) || string.Equals(fileName, text, StringComparison.OrdinalIgnoreCase)) ? text2 : ((deviceCategoryFolder == "IO_Devices" && string.Equals(fileName, "IO_Devices", StringComparison.OrdinalIgnoreCase)) ? text2 : ((!(deviceCategoryFolder == "IO_Devices")) ? Path.Combine(text2, deviceCategoryFolder, text, "DeviceConfiguration") : Path.Combine(text2, deviceCategoryFolder))));
			Directory.CreateDirectory(text3);
			new HwConfigCaxService().ExportDevice(device, text3, messages);
		}
		catch (Exception ex)
		{
			messages.Add(ExportMessage.Error(((HardwareObject)device).Name, "Device", "Failed to export device CAx: " + ex.Message));
		}
	}
}

