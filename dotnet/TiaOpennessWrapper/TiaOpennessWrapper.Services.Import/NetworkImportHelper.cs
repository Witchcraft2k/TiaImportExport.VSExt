using System;
using System.Collections.Generic;
using System.Linq;
using Siemens.Engineering;
using Siemens.Engineering.HW;
using Siemens.Engineering.HW.Features;
using TiaOpennessWrapper.Models;

namespace TiaOpennessWrapper.Services.Import;

internal static class NetworkImportHelper
{
	public static TiaNetworkInterfaceInfo? GetNetworkInterface(DeviceItem item)
	{
		try
		{
			NetworkInterface service = item.GetService<NetworkInterface>();
			if (service == null)
			{
				return null;
			}
			TiaNetworkInterfaceInfo tiaNetworkInterfaceInfo = new TiaNetworkInterfaceInfo
			{
				Id = ((HardwareObject)item).Name,
				Name = ((HardwareObject)item).Name,
				InterfaceType = DeviceItemHelper.GetInterfaceType(service),
				OperatingMode = GetInterfaceOperatingMode(service),
				Nodes = new List<TiaNetworkNodeInfo>()
			};
			tiaNetworkInterfaceInfo.IoSystemInfo = GetIoSystemInfo(service, item);
			foreach (Node node in service.Nodes)
			{
				TiaNetworkNodeInfo tiaNetworkNodeInfo = new TiaNetworkNodeInfo
				{
					Name = (node.GetAttribute("Name")?.ToString() ?? "")
				};
				try
				{
					foreach (EngineeringAttributeInfo attributeInfo in node.GetAttributeInfos())
					{
						try
						{
							switch (attributeInfo.Name)
							{
							case "Address":
								tiaNetworkNodeInfo.IpAddress = ConvertAddressToString(node.GetAttribute("Address"));
								break;
							case "SubnetMask":
								tiaNetworkNodeInfo.SubnetMask = ConvertAddressToString(node.GetAttribute("SubnetMask"));
								break;
							case "RouterAddress":
								tiaNetworkNodeInfo.RouterAddress = ConvertAddressToString(node.GetAttribute("RouterAddress"));
								break;
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
				try
				{
					Subnet connectedSubnet = node.ConnectedSubnet;
					if (connectedSubnet != null)
					{
						tiaNetworkNodeInfo.SubnetName = connectedSubnet.Name;
					}
				}
				catch
				{
				}
				tiaNetworkInterfaceInfo.Nodes.Add(tiaNetworkNodeInfo);
			}
			return tiaNetworkInterfaceInfo;
		}
		catch
		{
			return null;
		}
	}

	public static string GetInterfaceOperatingMode(NetworkInterface networkService)
	{
		//IL_0007: Unknown result type (might be due to invalid IL or missing references)
		//IL_000c: Unknown result type (might be due to invalid IL or missing references)
		//IL_000e: Unknown result type (might be due to invalid IL or missing references)
		//IL_001d: Unknown result type (might be due to invalid IL or missing references)
		try
		{
			List<string> list = new List<string>();
			InterfaceOperatingModes interfaceOperatingMode = networkService.InterfaceOperatingMode;
			if ((interfaceOperatingMode & (InterfaceOperatingModes)1) != (InterfaceOperatingModes)0)
			{
				list.Add("IoController");
			}
			if ((interfaceOperatingMode & (InterfaceOperatingModes)2) != (InterfaceOperatingModes)0)
			{
				list.Add("IoDevice");
			}
			return (list.Count > 0) ? string.Join(", ", list) : "None";
		}
		catch
		{
			return "Unknown";
		}
	}

	public static TiaIoSystemInfo? GetIoSystemInfo(NetworkInterface networkService, DeviceItem item)
	{
		//IL_0007: Unknown result type (might be due to invalid IL or missing references)
		//IL_000c: Unknown result type (might be due to invalid IL or missing references)
		//IL_000d: Unknown result type (might be due to invalid IL or missing references)
		//IL_000f: Unknown result type (might be due to invalid IL or missing references)
		//IL_0098: Unknown result type (might be due to invalid IL or missing references)
		//IL_009a: Unknown result type (might be due to invalid IL or missing references)
		try
		{
			TiaIoSystemInfo tiaIoSystemInfo = new TiaIoSystemInfo();
			InterfaceOperatingModes interfaceOperatingMode = networkService.InterfaceOperatingMode;
			if ((interfaceOperatingMode & (InterfaceOperatingModes)1) != (InterfaceOperatingModes)0)
			{
				tiaIoSystemInfo.IsIoController = true;
				foreach (IoController ioController2 in networkService.IoControllers)
				{
					try
					{
						IoSystem ioSystem = ioController2.IoSystem;
						if (ioSystem == null)
						{
							continue;
						}
						tiaIoSystemInfo.IoSystemName = ioSystem.Name;
						tiaIoSystemInfo.IoSystemNumber = ioSystem.Number;
						try
						{
							object attribute = ((IEngineeringObject)ioController2).GetAttribute("PnDeviceNumber");
							if (attribute != null)
							{
								tiaIoSystemInfo.PnDeviceNumber = Convert.ToInt32(attribute);
							}
						}
						catch
						{
						}
					}
					catch
					{
					}
				}
			}
			if ((interfaceOperatingMode & (InterfaceOperatingModes)2) != (InterfaceOperatingModes)0)
			{
				tiaIoSystemInfo.IsIoDevice = true;
				foreach (IoConnector ioConnector in networkService.IoConnectors)
				{
					try
					{
						IoSystem connectedToIoSystem = ioConnector.ConnectedToIoSystem;
						if (connectedToIoSystem != null)
						{
							tiaIoSystemInfo.IoSystemName = connectedToIoSystem.Name;
							tiaIoSystemInfo.IoSystemNumber = connectedToIoSystem.Number;
							try
							{
								IoController ioController = ioConnector.GetIoController();
								if (ioController != null)
								{
									IEngineeringObject parent = ioController.Parent;
									NetworkInterface val = (NetworkInterface)(object)((parent is NetworkInterface) ? parent : null);
									if (val != null)
									{
										IEngineeringObject parent2 = ((HardwareFeature)val).Parent;
										DeviceItem val2 = (DeviceItem)(object)((parent2 is DeviceItem) ? parent2 : null);
										if (val2 != null)
										{
											tiaIoSystemInfo.IoControllerName = ((HardwareObject)val2).Name;
											Device val3 = DeviceItemHelper.FindParentDevice(val2);
											if (val3 != null)
											{
												tiaIoSystemInfo.IoControllerDeviceName = DeviceItemHelper.GetDeviceDisplayName(val3);
											}
										}
									}
								}
							}
							catch
							{
							}
						}
						try
						{
							object attribute2 = ((IEngineeringObject)ioConnector).GetAttribute("PnDeviceNumber");
							if (attribute2 != null)
							{
								tiaIoSystemInfo.PnDeviceNumber = Convert.ToInt32(attribute2);
							}
						}
						catch
						{
						}
						try
						{
							object attribute3 = ((HardwareObject)item).GetAttribute("PnDeviceName");
							if (attribute3 != null)
							{
								tiaIoSystemInfo.PnDeviceName = attribute3.ToString();
							}
						}
						catch
						{
						}
						try
						{
							object attribute4 = ((IEngineeringObject)ioConnector).GetAttribute("PnUpdateTime");
							if (attribute4 != null)
							{
								tiaIoSystemInfo.UpdateTime = attribute4.ToString();
							}
						}
						catch
						{
						}
						try
						{
							object attribute5 = ((IEngineeringObject)ioConnector).GetAttribute("PnWatchdogTime");
							if (attribute5 != null)
							{
								tiaIoSystemInfo.WatchdogTime = attribute5.ToString();
							}
						}
						catch
						{
						}
					}
					catch
					{
					}
				}
			}
			if (string.IsNullOrEmpty(tiaIoSystemInfo.IoSystemName) && !tiaIoSystemInfo.IsIoController && !tiaIoSystemInfo.IsIoDevice)
			{
				return null;
			}
			return tiaIoSystemInfo;
		}
		catch
		{
			return null;
		}
	}

	public static List<TiaSubnetInfo> ImportSubnets(ProjectBase project, List<ExportMessage> messages)
	{
		List<TiaSubnetInfo> list = new List<TiaSubnetInfo>();
		try
		{
			foreach (Subnet subnet in ((ProjectBase)project).Subnets)
			{
				TiaSubnetInfo tiaSubnetInfo = new TiaSubnetInfo
				{
					Id = subnet.Name,
					Name = subnet.Name,
					SubnetType = DeviceItemHelper.GetSubnetType(subnet),
					ConnectedDevices = new List<string>(),
					IoSystems = new List<TiaSubnetIoSystemInfo>()
				};
				try
				{
					foreach (Node node in subnet.Nodes)
					{
						try
						{
							string nodeDeviceName = DeviceItemHelper.GetNodeDeviceName(node);
							if (!string.IsNullOrEmpty(nodeDeviceName) && !tiaSubnetInfo.ConnectedDevices.Contains(nodeDeviceName))
							{
								tiaSubnetInfo.ConnectedDevices.Add(nodeDeviceName);
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
				try
				{
					foreach (IoSystem ioSystem in subnet.IoSystems)
					{
						TiaSubnetIoSystemInfo tiaSubnetIoSystemInfo = new TiaSubnetIoSystemInfo
						{
							Name = ioSystem.Name,
							Number = ioSystem.Number,
							ConnectedIoDevices = new List<TiaConnectedIoDeviceInfo>()
						};
						try
						{
							IEngineeringObject parent = ioSystem.Parent;
							IoController val = (IoController)(object)((parent is IoController) ? parent : null);
							if (val != null)
							{
								IEngineeringObject parent2 = val.Parent;
								NetworkInterface val2 = (NetworkInterface)(object)((parent2 is NetworkInterface) ? parent2 : null);
								if (val2 != null)
								{
									IEngineeringObject parent3 = ((HardwareFeature)val2).Parent;
									DeviceItem val3 = (DeviceItem)(object)((parent3 is DeviceItem) ? parent3 : null);
									if (val3 != null)
									{
										Device val4 = DeviceItemHelper.FindParentDevice(val3);
										if (val4 != null)
										{
											tiaSubnetIoSystemInfo.IoControllerDeviceName = DeviceItemHelper.GetDeviceDisplayName(val4);
										}
									}
								}
							}
						}
						catch
						{
						}
						try
						{
							foreach (IoConnector connectedIoDevice in ioSystem.ConnectedIoDevices)
							{
								TiaConnectedIoDeviceInfo tiaConnectedIoDeviceInfo = new TiaConnectedIoDeviceInfo();
								try
								{
									IEngineeringObject parent4 = connectedIoDevice.Parent;
									NetworkInterface val5 = (NetworkInterface)(object)((parent4 is NetworkInterface) ? parent4 : null);
									if (val5 != null)
									{
										IEngineeringObject parent5 = ((HardwareFeature)val5).Parent;
										DeviceItem val6 = (DeviceItem)(object)((parent5 is DeviceItem) ? parent5 : null);
										if (val6 != null)
										{
											Device val7 = DeviceItemHelper.FindParentDevice(val6);
											if (val7 != null)
											{
												tiaConnectedIoDeviceInfo.DeviceName = DeviceItemHelper.GetDeviceDisplayName(val7);
											}
										}
									}
								}
								catch
								{
								}
								try
								{
									object attribute = ((IEngineeringObject)connectedIoDevice).GetAttribute("PnDeviceNumber");
									if (attribute != null)
									{
										tiaConnectedIoDeviceInfo.PnDeviceNumber = Convert.ToInt32(attribute);
									}
								}
								catch
								{
								}
								try
								{
									IEngineeringObject parent6 = connectedIoDevice.Parent;
									NetworkInterface val8 = (NetworkInterface)(object)((parent6 is NetworkInterface) ? parent6 : null);
									if (val8 != null)
									{
										IEngineeringObject parent7 = ((HardwareFeature)val8).Parent;
										DeviceItem val9 = (DeviceItem)(object)((parent7 is DeviceItem) ? parent7 : null);
										if (val9 != null)
										{
											object attribute2 = ((HardwareObject)val9).GetAttribute("PnDeviceName");
											if (attribute2 != null)
											{
												tiaConnectedIoDeviceInfo.PnDeviceName = attribute2.ToString();
											}
										}
									}
								}
								catch
								{
								}
								if (!string.IsNullOrEmpty(tiaConnectedIoDeviceInfo.DeviceName))
								{
									tiaSubnetIoSystemInfo.ConnectedIoDevices.Add(tiaConnectedIoDeviceInfo);
								}
							}
						}
						catch
						{
						}
						tiaSubnetInfo.IoSystems.Add(tiaSubnetIoSystemInfo);
					}
				}
				catch
				{
				}
				list.Add(tiaSubnetInfo);
				messages.Add(ExportMessage.Info(subnet.Name, "Subnet", $"Imported subnet: {subnet.Name} with {tiaSubnetInfo.IoSystems.Count} IO systems"));
			}
		}
		catch (Exception ex)
		{
			messages.Add(ExportMessage.Warning("Subnets", "Network", "Error importing subnets: " + ex.Message));
		}
		return list;
	}

	private static string ConvertAddressToString(object? addressValue)
	{
		if (addressValue == null)
		{
			return string.Empty;
		}
		if (addressValue is string result)
		{
			return result;
		}
		if (addressValue is byte[] array)
		{
			if (array.Length == 4)
			{
				return $"{array[0]}.{array[1]}.{array[2]}.{array[3]}";
			}
			if (array.Length == 6)
			{
				return string.Join("-", array.Select((byte b) => b.ToString("X2")));
			}
			return string.Join(".", array.Select((byte b) => b.ToString()));
		}
		if (addressValue is Array { Length: >0 } array2)
		{
			List<string> list = new List<string>();
			foreach (object item in array2)
			{
				if (item != null)
				{
					list.Add(item.ToString() ?? "0");
				}
			}
			if (list.Count == 4)
			{
				return string.Join(".", list);
			}
		}
		string text = addressValue.ToString();
		if (text != null && !text.Contains("System.") && !text.Contains("[]"))
		{
			return text;
		}
		return string.Empty;
	}
}
