using System;
using System.Collections.Generic;
using System.Linq;
using Siemens.Engineering;
using Siemens.Engineering.HW;
using TiaOpennessWrapper.Models;

namespace TiaOpennessWrapper.Services.Import;

internal static class DeviceImportHelper
{
	public static TiaHwDeviceInfo? ImportDeviceConfig(Device device, HwConfigImportOptions options, List<ExportMessage> messages)
	{
		string deviceDisplayName = DeviceItemHelper.GetDeviceDisplayName(device);
		TiaHwDeviceInfo tiaHwDeviceInfo = new TiaHwDeviceInfo
		{
			Id = ((HardwareObject)device).Name,
			Name = deviceDisplayName,
			TypeIdentifier = DeviceItemHelper.GetDeviceTypeIdentifier(device),
			DeviceType = DeviceItemHelper.GetDeviceType(device),
			Racks = new List<TiaRackInfo>(),
			NetworkInterfaces = new List<TiaNetworkInterfaceInfo>()
		};
		try
		{
			foreach (EngineeringAttributeInfo attributeInfo in ((HardwareObject)device).GetAttributeInfos())
			{
				try
				{
					if (attributeInfo.Name == "Comment")
					{
						tiaHwDeviceInfo.Comment = ((HardwareObject)device).GetAttribute("Comment")?.ToString();
					}
				}
				catch
				{
				}
			}
		}
		catch
		{
		}
		int rackNumber = 0;
		foreach (DeviceItem deviceItem in ((HardwareObject)device).DeviceItems)
		{
			ProcessDeviceItem(deviceItem, tiaHwDeviceInfo, options, messages, ref rackNumber, null);
		}
		return tiaHwDeviceInfo;
	}

	public static void ProcessDeviceItem(DeviceItem item, TiaHwDeviceInfo deviceInfo, HwConfigImportOptions options, List<ExportMessage> messages, ref int rackNumber, TiaModuleInfo? parentModule)
	{
		if (DeviceItemHelper.GetDeviceItemClassification(item) == "Rack")
		{
			TiaRackInfo item2 = new TiaRackInfo
			{
				Id = ((HardwareObject)item).Name,
				Name = ((HardwareObject)item).Name,
				RackNumber = rackNumber++,
				Modules = new List<TiaModuleInfo>()
			};
			deviceInfo.Racks.Add(item2);
			foreach (DeviceItem deviceItem in ((HardwareObject)item).DeviceItems)
			{
				ProcessDeviceItem(deviceItem, deviceInfo, options, messages, ref rackNumber, null);
			}
		}
		else if (DeviceItemHelper.IsModule(item))
		{
			TiaModuleInfo tiaModuleInfo = CreateModuleInfo(item, options);
			if (options.IncludeAddresses)
			{
				tiaModuleInfo.Addresses = GetModuleAddresses(item);
			}
			if (options.IncludeChannels)
			{
				tiaModuleInfo.Channels = GetModuleChannels(item);
			}
			if (deviceInfo.Racks.Count == 0)
			{
				deviceInfo.Racks.Add(new TiaRackInfo
				{
					Id = "Rack_0",
					Name = "Main Rack",
					RackNumber = 0,
					Modules = new List<TiaModuleInfo>()
				});
			}
			deviceInfo.Racks.Last().Modules.Add(tiaModuleInfo);
			foreach (DeviceItem deviceItem2 in ((HardwareObject)item).DeviceItems)
			{
				TiaModuleInfo tiaModuleInfo2 = CreateModuleInfo(deviceItem2, options);
				if (tiaModuleInfo2 != null && DeviceItemHelper.IsModule(deviceItem2))
				{
					tiaModuleInfo.SubModules.Add(tiaModuleInfo2);
				}
			}
		}
		if (options.IncludeNetworkConfig)
		{
			TiaNetworkInterfaceInfo networkInterface = NetworkImportHelper.GetNetworkInterface(item);
			if (networkInterface != null)
			{
				deviceInfo.NetworkInterfaces.Add(networkInterface);
			}
		}
		foreach (DeviceItem deviceItem3 in ((HardwareObject)item).DeviceItems)
		{
			if (!DeviceItemHelper.IsModule(deviceItem3) && DeviceItemHelper.GetDeviceItemClassification(deviceItem3) != "Rack")
			{
				ProcessDeviceItem(deviceItem3, deviceInfo, options, messages, ref rackNumber, null);
			}
		}
	}

	public static TiaModuleInfo CreateModuleInfo(DeviceItem item, HwConfigImportOptions options)
	{
		TiaModuleInfo tiaModuleInfo = new TiaModuleInfo
		{
			Id = ((HardwareObject)item).Name,
			Name = ((HardwareObject)item).Name,
			TypeIdentifier = DeviceItemHelper.GetTypeIdentifier(item),
			PositionNumber = DeviceItemHelper.GetPositionNumber(item),
			ModuleType = DeviceItemHelper.GetModuleType(item),
			IsCpu = DeviceItemHelper.IsCpuModule(item),
			IsIoModule = DeviceItemHelper.IsIoModule(item),
			SubModules = new List<TiaModuleInfo>(),
			Channels = new List<TiaChannelInfo>()
		};
		try
		{
			foreach (EngineeringAttributeInfo attributeInfo in ((HardwareObject)item).GetAttributeInfos())
			{
				try
				{
					switch (attributeInfo.Name)
					{
					case "OrderNumber":
						tiaModuleInfo.OrderNumber = ((HardwareObject)item).GetAttribute("OrderNumber")?.ToString();
						break;
					case "FirmwareVersion":
						tiaModuleInfo.FirmwareVersion = ((HardwareObject)item).GetAttribute("FirmwareVersion")?.ToString();
						break;
					case "Comment":
						tiaModuleInfo.Comment = ((HardwareObject)item).GetAttribute("Comment")?.ToString();
						break;
					case "PositionNumber":
					{
						object attribute = ((HardwareObject)item).GetAttribute("PositionNumber");
						if (attribute != null)
						{
							tiaModuleInfo.SlotNumber = Convert.ToInt32(attribute);
						}
						break;
					}
					}
				}
				catch
				{
				}
			}
		}
		catch
		{
		}
		return tiaModuleInfo;
	}

	public static TiaModuleAddressInfo? GetModuleAddresses(DeviceItem item)
	{
		try
		{
			TiaModuleAddressInfo tiaModuleAddressInfo = new TiaModuleAddressInfo();
			bool flag = false;
			foreach (EngineeringAttributeInfo attributeInfo in ((HardwareObject)item).GetAttributeInfos())
			{
				try
				{
					string name = attributeInfo.Name;
					if (name == null)
					{
						continue;
					}
					object attribute;
					object attribute2;
					switch (name.Length)
					{
					default:
						goto end_IL_0020;
					case 12:
					{
						char c = name[0];
						if (c != 'I')
						{
							switch (c)
							{
							default:
								goto end_IL_0020;
							case 'O':
								if (name == "OutputLength")
								{
									break;
								}
								goto end_IL_0020;
							case 'L':
								if (name == "LengthOutput")
								{
									break;
								}
								goto end_IL_0020;
							}
							break;
						}
						if (name == "InputAddress")
						{
							goto IL_014a;
						}
						goto end_IL_0020;
					}
					case 11:
					{
						switch (name[0])
						{
						default:
							goto end_IL_0020;
						case 'I':
							if (name == "InputLength")
							{
								break;
							}
							goto end_IL_0020;
						case 'L':
							if (name == "LengthInput")
							{
								break;
							}
							goto end_IL_0020;
						}
						object attribute3 = ((HardwareObject)item).GetAttribute(attributeInfo.Name);
						if (attribute3 != null)
						{
							tiaModuleAddressInfo.InputLength = Convert.ToInt32(attribute3);
						}
						goto end_IL_0020;
					}
					case 17:
						if (name == "StartAddressInput")
						{
							goto IL_014a;
						}
						goto end_IL_0020;
					case 13:
						if (name == "OutputAddress")
						{
							goto IL_0175;
						}
						goto end_IL_0020;
					case 18:
						if (name == "StartAddressOutput")
						{
							goto IL_0175;
						}
						goto end_IL_0020;
					case 14:
					case 15:
					case 16:
						goto end_IL_0020;
						IL_0175:
						attribute = ((HardwareObject)item).GetAttribute(attributeInfo.Name);
						if (attribute != null)
						{
							tiaModuleAddressInfo.OutputStartAddress = Convert.ToInt32(attribute);
							flag = true;
						}
						goto end_IL_0020;
						IL_014a:
						attribute2 = ((HardwareObject)item).GetAttribute(attributeInfo.Name);
						if (attribute2 != null)
						{
							tiaModuleAddressInfo.InputStartAddress = Convert.ToInt32(attribute2);
							flag = true;
						}
						goto end_IL_0020;
					}
					object attribute4 = ((HardwareObject)item).GetAttribute(attributeInfo.Name);
					if (attribute4 != null)
					{
						tiaModuleAddressInfo.OutputLength = Convert.ToInt32(attribute4);
					}
					end_IL_0020:;
				}
				catch
				{
				}
			}
			return flag ? tiaModuleAddressInfo : null;
		}
		catch
		{
			return null;
		}
	}

	public static List<TiaChannelInfo> GetModuleChannels(DeviceItem item)
	{
		List<TiaChannelInfo> list = new List<TiaChannelInfo>();
		try
		{
			foreach (DeviceItem deviceItem in ((HardwareObject)item).DeviceItems)
			{
				if (!DeviceItemHelper.IsChannel(deviceItem))
				{
					continue;
				}
				TiaChannelInfo tiaChannelInfo = new TiaChannelInfo
				{
					Number = DeviceItemHelper.GetChannelNumber(deviceItem),
					Name = ((HardwareObject)deviceItem).Name,
					ChannelType = DeviceItemHelper.GetChannelType(deviceItem),
					IoType = DeviceItemHelper.GetChannelIoType(deviceItem)
				};
				try
				{
					object attribute = ((HardwareObject)deviceItem).GetAttribute("Address");
					if (attribute != null)
					{
						tiaChannelInfo.Address = attribute.ToString();
					}
				}
				catch
				{
				}
				list.Add(tiaChannelInfo);
			}
		}
		catch
		{
		}
		return list;
	}
}
