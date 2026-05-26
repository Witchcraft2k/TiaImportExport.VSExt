using System;
using System.Collections.Generic;
using System.Xml;
using Siemens.Engineering;
using Siemens.Engineering.HW;
using Siemens.Engineering.HW.Features;
using TiaOpennessWrapper.Models;
using TiaOpennessWrapper.Services.Import;

namespace TiaOpennessWrapper.Services.Export;

internal class NetworkExportHelper
{
	private class XmlInterfaceInfo
	{
		public string InterfaceType { get; set; } = "Ethernet";

		public string InterfaceName { get; set; } = "";

		public string ParentModuleName { get; set; } = "";

		public string Label { get; set; } = "";
	}

	private readonly List<ExportMessage> _messages;

	private void ConfigureSpecificNodeAddress(Device device, string address, string? subnetMask, string? subnetName, XmlInterfaceInfo interfaceInfo)
	{
		string deviceDisplayName = DeviceItemHelper.GetDeviceDisplayName(device);
		if (IsProfibusAddress(address, interfaceInfo.InterfaceType))
		{
			ConfigureSpecificProfibusAddress(device, address, interfaceInfo, deviceDisplayName);
		}
		else
		{
			ConfigureSpecificIpAddress(device, address, subnetMask, subnetName, interfaceInfo, deviceDisplayName);
		}
	}

	private void ConfigureSpecificProfibusAddress(Device device, string address, XmlInterfaceInfo interfaceInfo, string displayName)
	{
		try
		{
			if (!int.TryParse(address, out var result))
			{
				_messages.Add(ExportMessage.Warning(displayName, "Network", "Invalid PROFIBUS address: " + address));
				return;
			}
			NetworkInterface val = FindSpecificNetworkInterface(device, interfaceInfo, "Profibus");
			if (val != null)
			{
				foreach (Node node in val.Nodes)
				{
					bool flag = false;
					try
					{
						node.SetAttribute("Address", (object)address);
						flag = true;
					}
					catch
					{
					}
					if (!flag)
					{
						try
						{
							node.SetAttribute("Address", (object)result);
							flag = true;
						}
						catch
						{
						}
					}
					if (!flag)
					{
						try
						{
							node.SetAttribute("Address", (object)(byte)result);
							flag = true;
						}
						catch
						{
						}
					}
					if (!flag)
					{
						try
						{
							node.SetAttribute("ProfibusAddress", (object)result);
							flag = true;
						}
						catch
						{
						}
					}
					if (flag)
					{
						string arg = ((!string.IsNullOrEmpty(interfaceInfo.ParentModuleName)) ? (" (" + interfaceInfo.ParentModuleName + ")") : "");
						_messages.Add(ExportMessage.Info(displayName, "Network", $"Set PROFIBUS address to {result} on {interfaceInfo.InterfaceName}{arg}"));
						break;
					}
					_messages.Add(ExportMessage.Warning(displayName, "Network", "Could not set PROFIBUS address on " + interfaceInfo.InterfaceName + " - address attribute not supported"));
				}
				return;
			}
			_messages.Add(ExportMessage.Warning(displayName, "Network", "PROFIBUS interface '" + interfaceInfo.InterfaceName + "' not found on device"));
		}
		catch (Exception ex)
		{
			_messages.Add(ExportMessage.Warning(displayName, "Network", "Could not configure PROFIBUS address: " + ex.Message));
		}
	}

	private void ConfigureSpecificIpAddress(Device device, string ipAddress, string? subnetMask, string? subnetName, XmlInterfaceInfo interfaceInfo, string displayName)
	{
		try
		{
			NetworkInterface val = FindSpecificNetworkInterface(device, interfaceInfo, "Ethernet");
			if (val == null)
			{
				_messages.Add(ExportMessage.Warning(displayName, "Network", "Ethernet interface '" + interfaceInfo.InterfaceName + "' not found on device"));
				return;
			}
			bool flag = IsIoDevice(device);
			using IEnumerator<Node> enumerator = val.Nodes.GetEnumerator();
			if (!enumerator.MoveNext())
			{
				return;
			}
			Node current = enumerator.Current;
			try
			{
				current.SetAttribute("Address", (object)ipAddress);
				string text = ((!string.IsNullOrEmpty(interfaceInfo.InterfaceName)) ? (" on " + interfaceInfo.InterfaceName) : "");
				if (!string.IsNullOrEmpty(interfaceInfo.ParentModuleName))
				{
					text = " (" + interfaceInfo.ParentModuleName + ")";
				}
				_messages.Add(ExportMessage.Info(displayName, "Network", "Set IP address to " + ipAddress + text));
				if (!string.IsNullOrEmpty(subnetMask) && !flag)
				{
					try
					{
						current.SetAttribute("SubnetMask", (object)subnetMask);
						return;
					}
					catch (Exception ex)
					{
						_messages.Add(ExportMessage.Info(displayName, "Network", "SubnetMask not set (not supported): " + ex.Message));
						return;
					}
				}
			}
			catch (Exception ex2)
			{
				_messages.Add(ExportMessage.Warning(displayName, "Network", "Could not set IP address on " + interfaceInfo.InterfaceName + ": " + ex2.Message));
			}
		}
		catch (Exception ex3)
		{
			_messages.Add(ExportMessage.Warning(displayName, "Network", "Could not configure IP: " + ex3.Message));
		}
	}

	public NetworkExportHelper(List<ExportMessage> messages)
	{
		_messages = messages;
	}

	public void ConfigureDeviceNetwork(ProjectBase project, Device device, XmlNode deviceNode)
	{
		string deviceDisplayName = DeviceItemHelper.GetDeviceDisplayName(device);
		try
		{
			foreach (XmlNode item in XmlExportHelper.FindNetworkInterfaceNodes(deviceNode))
			{
				XmlInterfaceInfo interfaceInfoFromXml = GetInterfaceInfoFromXml(item);
				foreach (XmlNode item2 in XmlExportHelper.FindChildNodes(item, "IoSystem"))
				{
					string text = item2.Attributes?["Name"]?.Value;
					string text2 = item2.Attributes?["Role"]?.Value;
					string pnDeviceNumberStr = item2.Attributes?["PnDeviceNumber"]?.Value;
					string text3 = item2.Attributes?["IoControllerDevice"]?.Value;
					string pnDeviceName = item2.Attributes?["PnDeviceName"]?.Value;
					if (!string.IsNullOrEmpty(text) && text2 == "IoDevice" && !string.IsNullOrEmpty(text3))
					{
						ConnectDeviceToIoSystem(project, device, text, text3, pnDeviceNumberStr, pnDeviceName);
					}
				}
				foreach (XmlNode item3 in XmlExportHelper.FindChildNodes(item, "Node"))
				{
					string text4 = item3.Attributes?["Address"]?.Value;
					string subnetMask = item3.Attributes?["SubnetMask"]?.Value;
					string subnetName = item3.Attributes?["Subnet"]?.Value;
					if (!string.IsNullOrEmpty(text4))
					{
						ConfigureSpecificNodeAddress(device, text4, subnetMask, subnetName, interfaceInfoFromXml);
					}
				}
			}
		}
		catch (Exception ex)
		{
			_messages.Add(ExportMessage.Warning(deviceDisplayName, "Network", "Could not configure network: " + ex.Message));
		}
	}

	private XmlInterfaceInfo GetInterfaceInfoFromXml(XmlNode networkInterfaceNode)
	{
		XmlInterfaceInfo xmlInterfaceInfo = new XmlInterfaceInfo();
		XmlNode parentNode = networkInterfaceNode.ParentNode;
		if (parentNode != null)
		{
			xmlInterfaceInfo.InterfaceType = parentNode.Attributes?["InterfaceType"]?.Value ?? "Ethernet";
			xmlInterfaceInfo.InterfaceName = parentNode.Attributes?["Name"]?.Value ?? "";
			xmlInterfaceInfo.Label = parentNode.Attributes?["Label"]?.Value ?? "";
			for (XmlNode parentNode2 = parentNode.ParentNode; parentNode2 != null; parentNode2 = parentNode2.ParentNode)
			{
				if ((parentNode2.Name == "DeviceItem" || parentNode2.LocalName == "DeviceItem") && !string.IsNullOrEmpty(parentNode2.Attributes?["OrderNumber"]?.Value))
				{
					xmlInterfaceInfo.ParentModuleName = parentNode2.Attributes?["Name"]?.Value ?? "";
					break;
				}
			}
		}
		return xmlInterfaceInfo;
	}

	private NetworkInterface? FindSpecificNetworkInterface(Device device, XmlInterfaceInfo interfaceInfo, string defaultType)
	{
		if (!string.IsNullOrEmpty(interfaceInfo.ParentModuleName))
		{
			NetworkInterface val = FindNetworkInterfaceByModuleName(((HardwareObject)device).DeviceItems, interfaceInfo.ParentModuleName);
			if (val != null)
			{
				return val;
			}
		}
		if (!string.IsNullOrEmpty(interfaceInfo.InterfaceName) && !string.IsNullOrEmpty(interfaceInfo.ParentModuleName))
		{
			DeviceItem val2 = FindDeviceItemByName(((HardwareObject)device).DeviceItems, interfaceInfo.ParentModuleName);
			if (val2 != null)
			{
				NetworkInterface val3 = FindNetworkInterfaceByName(((HardwareObject)val2).DeviceItems, interfaceInfo.InterfaceName);
				if (val3 != null)
				{
					return val3;
				}
			}
		}
		if (!string.IsNullOrEmpty(interfaceInfo.InterfaceName))
		{
			NetworkInterface val4 = FindNetworkInterfaceByName(((HardwareObject)device).DeviceItems, interfaceInfo.InterfaceName);
			if (val4 != null)
			{
				return val4;
			}
		}
		if (!string.IsNullOrEmpty(interfaceInfo.Label))
		{
			NetworkInterface val5 = FindNetworkInterfaceByLabel(((HardwareObject)device).DeviceItems, interfaceInfo.Label);
			if (val5 != null)
			{
				return val5;
			}
		}
		string interfaceType = ((!string.IsNullOrEmpty(interfaceInfo.InterfaceType)) ? interfaceInfo.InterfaceType : defaultType);
		return FindNetworkInterfaceByType(((HardwareObject)device).DeviceItems, interfaceType);
	}

	private DeviceItem? FindDeviceItemByName(DeviceItemComposition items, string name)
	{
		foreach (DeviceItem item in items)
		{
			if (((HardwareObject)item).Name == name)
			{
				return item;
			}
			if (((HardwareObject)item).DeviceItems.Count > 0)
			{
				DeviceItem val = FindDeviceItemByName(((HardwareObject)item).DeviceItems, name);
				if (val != null)
				{
					return val;
				}
			}
		}
		return null;
	}

	private NetworkInterface? FindNetworkInterfaceByName(DeviceItemComposition items, string name)
	{
		foreach (DeviceItem item in items)
		{
			if (!(((HardwareObject)item).Name == name))
			{
				string name2 = ((HardwareObject)item).Name;
				if (name2 == null || !name2.Contains(name))
				{
					goto IL_0041;
				}
			}
			NetworkInterface service = item.GetService<NetworkInterface>();
			if (service != null)
			{
				return service;
			}
			goto IL_0041;
			IL_0041:
			if (((HardwareObject)item).DeviceItems.Count > 0)
			{
				NetworkInterface val = FindNetworkInterfaceByName(((HardwareObject)item).DeviceItems, name);
				if (val != null)
				{
					return val;
				}
			}
		}
		return null;
	}

	private NetworkInterface? FindNetworkInterfaceByModuleName(DeviceItemComposition items, string moduleName)
	{
		foreach (DeviceItem item in items)
		{
			if (!(((HardwareObject)item).Name == moduleName))
			{
				string name = ((HardwareObject)item).Name;
				if (name == null || !name.Contains(moduleName))
				{
					goto IL_0047;
				}
			}
			NetworkInterface val = FindFirstNetworkInterfaceRecursive(((HardwareObject)item).DeviceItems);
			if (val != null)
			{
				return val;
			}
			goto IL_0047;
			IL_0047:
			if (((HardwareObject)item).DeviceItems.Count > 0)
			{
				NetworkInterface val2 = FindNetworkInterfaceByModuleName(((HardwareObject)item).DeviceItems, moduleName);
				if (val2 != null)
				{
					return val2;
				}
			}
		}
		return null;
	}

	private NetworkInterface? FindNetworkInterfaceByLabel(DeviceItemComposition items, string label)
	{
		foreach (DeviceItem item in items)
		{
			try
			{
				if (((HardwareObject)item).GetAttribute("Label")?.ToString() == label)
				{
					NetworkInterface service = item.GetService<NetworkInterface>();
					if (service != null)
					{
						return service;
					}
				}
			}
			catch
			{
			}
			if (((HardwareObject)item).DeviceItems.Count > 0)
			{
				NetworkInterface val = FindNetworkInterfaceByLabel(((HardwareObject)item).DeviceItems, label);
				if (val != null)
				{
					return val;
				}
			}
		}
		return null;
	}

	private NetworkInterface? FindFirstNetworkInterfaceRecursive(DeviceItemComposition items)
	{
		foreach (DeviceItem item in items)
		{
			try
			{
				NetworkInterface service = item.GetService<NetworkInterface>();
				if (service != null)
				{
					return service;
				}
			}
			catch
			{
			}
			if (((HardwareObject)item).DeviceItems.Count > 0)
			{
				NetworkInterface val = FindFirstNetworkInterfaceRecursive(((HardwareObject)item).DeviceItems);
				if (val != null)
				{
					return val;
				}
			}
		}
		return null;
	}

	private string GetInterfaceTypeFromXml(XmlNode networkInterfaceNode)
	{
		XmlNode parentNode = networkInterfaceNode.ParentNode;
		if (parentNode != null)
		{
			string text = parentNode.Attributes?["InterfaceType"]?.Value;
			if (!string.IsNullOrEmpty(text))
			{
				return text;
			}
		}
		return "Ethernet";
	}

	private NetworkInterface? FindNetworkInterfaceByType(DeviceItemComposition items, string interfaceType)
	{
		foreach (DeviceItem item in items)
		{
			try
			{
				string source = ((HardwareObject)item).GetAttribute("TypeName")?.ToString() ?? "";
				string source2 = ((HardwareObject)item).Name ?? "";
				if (source.Contains(interfaceType, StringComparison.OrdinalIgnoreCase) || source2.Contains(interfaceType, StringComparison.OrdinalIgnoreCase))
				{
					NetworkInterface service = item.GetService<NetworkInterface>();
					if (service != null)
					{
						return service;
					}
				}
			}
			catch
			{
			}
			if (((HardwareObject)item).DeviceItems.Count > 0)
			{
				NetworkInterface val = FindNetworkInterfaceByType(((HardwareObject)item).DeviceItems, interfaceType);
				if (val != null)
				{
					return val;
				}
			}
		}
		return null;
	}

	private DeviceItem? FindDeviceItemByInterfaceType(DeviceItemComposition items, string interfaceType)
	{
		foreach (DeviceItem item in items)
		{
			try
			{
				string source = ((HardwareObject)item).GetAttribute("TypeName")?.ToString() ?? "";
				string source2 = ((HardwareObject)item).Name ?? "";
				if (source.Contains(interfaceType, StringComparison.OrdinalIgnoreCase) || source2.Contains(interfaceType, StringComparison.OrdinalIgnoreCase))
				{
					return item;
				}
			}
			catch
			{
			}
			if (((HardwareObject)item).DeviceItems.Count > 0)
			{
				DeviceItem val = FindDeviceItemByInterfaceType(((HardwareObject)item).DeviceItems, interfaceType);
				if (val != null)
				{
					return val;
				}
			}
		}
		return null;
	}

	public NetworkInterface? FindDeviceNetworkInterface(Device device)
	{
		return FindNetworkInterfaceRecursive(((HardwareObject)device).DeviceItems);
	}

	private NetworkInterface? FindNetworkInterfaceRecursive(DeviceItemComposition items)
	{
		foreach (DeviceItem item in items)
		{
			try
			{
				NetworkInterface service = item.GetService<NetworkInterface>();
				if (service != null)
				{
					return service;
				}
			}
			catch
			{
			}
			if (((HardwareObject)item).DeviceItems.Count > 0)
			{
				NetworkInterface val = FindNetworkInterfaceRecursive(((HardwareObject)item).DeviceItems);
				if (val != null)
				{
					return val;
				}
			}
		}
		return null;
	}

	public DeviceItem? FindNetworkInterfaceDeviceItem(Device device)
	{
		return FindNetworkInterfaceDeviceItemRecursive(((HardwareObject)device).DeviceItems);
	}

	private DeviceItem? FindNetworkInterfaceDeviceItemRecursive(DeviceItemComposition items)
	{
		foreach (DeviceItem item in items)
		{
			try
			{
				if (item.GetService<NetworkInterface>() != null)
				{
					return item;
				}
			}
			catch
			{
			}
			if (((HardwareObject)item).DeviceItems.Count > 0)
			{
				DeviceItem val = FindNetworkInterfaceDeviceItemRecursive(((HardwareObject)item).DeviceItems);
				if (val != null)
				{
					return val;
				}
			}
		}
		return null;
	}

	private Device? FindDeviceByName(ProjectBase project, string deviceName)
	{
		foreach (Device device in project.Devices)
		{
			string deviceDisplayName = DeviceItemHelper.GetDeviceDisplayName(device);
			if (deviceDisplayName == deviceName || ((HardwareObject)device).Name == deviceName)
			{
				return device;
			}
			if (deviceDisplayName.Contains(deviceName) || deviceName.Contains(deviceDisplayName))
			{
				return device;
			}
			foreach (DeviceItem deviceItem in ((HardwareObject)device).DeviceItems)
			{
				if (((HardwareObject)deviceItem).Name == deviceName)
				{
					return device;
				}
			}
		}
		return null;
	}

	private bool IsIoDevice(Device device)
	{
		try
		{
			if (string.IsNullOrEmpty(((HardwareObject)device).TypeIdentifier))
			{
				return false;
			}
			foreach (DeviceItem deviceItem in ((HardwareObject)device).DeviceItems)
			{
				try
				{
					string obj = ((HardwareObject)deviceItem).GetAttribute("Classification")?.ToString();
					string text = ((HardwareObject)deviceItem).GetAttribute("TypeName")?.ToString();
					string text2 = ((HardwareObject)deviceItem).GetAttribute("OrderNumber")?.ToString();
					if (obj == "HM" && ((text != null && text.Contains("IM")) || (text2 != null && text2.StartsWith("6ES7 155")) || (text2 != null && text2.StartsWith("6ES7155"))))
					{
						return true;
					}
				}
				catch
				{
				}
			}
			return false;
		}
		catch
		{
			return false;
		}
	}

	private void ConnectDeviceToIoSystem(ProjectBase project, Device device, string ioSystemName, string ioControllerDeviceName, string? pnDeviceNumberStr, string? pnDeviceName)
	{
		string deviceDisplayName = DeviceItemHelper.GetDeviceDisplayName(device);
		try
		{
			_messages.Add(ExportMessage.Info(deviceDisplayName, "Network", "Looking for IoSystem '" + ioSystemName + "' on IoController '" + ioControllerDeviceName + "'"));
			IoSystem val = null;
			Subnet val2 = null;
			Device val3 = FindDeviceByName(project, ioControllerDeviceName);
			if (val3 != null)
			{
				_messages.Add(ExportMessage.Info(deviceDisplayName, "Network", "Found IoController device: " + DeviceItemHelper.GetDeviceDisplayName(val3)));
				val = FindIoSystemOnDevice(val3, ioSystemName);
				if (val == null)
				{
					_messages.Add(ExportMessage.Info(deviceDisplayName, "Network", "IoSystem '" + ioSystemName + "' not found on device, trying to find any IoSystem"));
					val = FindIoSystemOnDevice(val3, null);
					if (val != null)
					{
						_messages.Add(ExportMessage.Info(deviceDisplayName, "Network", "Found IoSystem '" + val.Name + "' on IoController device"));
					}
				}
				if (val != null)
				{
					foreach (Subnet subnet in project.Subnets)
					{
						foreach (IoSystem ioSystem in subnet.IoSystems)
						{
							string ioSystemControllerName = GetIoSystemControllerName(ioSystem);
							if (ioSystemControllerName != null && (ioSystemControllerName == ioControllerDeviceName || ioSystemControllerName.Contains(ioControllerDeviceName) || ioControllerDeviceName.Contains(ioSystemControllerName)))
							{
								val2 = subnet;
								val = ioSystem;
								_messages.Add(ExportMessage.Info(deviceDisplayName, "Network", "Found IoSystem '" + ioSystem.Name + "' on subnet '" + subnet.Name + "' (IoController: " + ioSystemControllerName + ")"));
								break;
							}
						}
						if (val2 != null)
						{
							break;
						}
					}
					if (val2 == null)
					{
						_messages.Add(ExportMessage.Warning(deviceDisplayName, "Network", "Could not find subnet for IoSystem '" + val.Name + "' on IoController '" + ioControllerDeviceName + "'"));
					}
				}
			}
			else
			{
				_messages.Add(ExportMessage.Warning(deviceDisplayName, "Network", "IoController device '" + ioControllerDeviceName + "' not found, searching by IoSystem name"));
			}
			if (val == null)
			{
				_messages.Add(ExportMessage.Info(deviceDisplayName, "Network", "Searching all subnets for IoSystem by IoController name '" + ioControllerDeviceName + "'..."));
				foreach (Subnet subnet2 in ((ProjectBase)project).Subnets)
				{
					foreach (IoSystem ioSystem2 in subnet2.IoSystems)
					{
						string ioSystemControllerName2 = GetIoSystemControllerName(ioSystem2);
						_messages.Add(ExportMessage.Info(deviceDisplayName, "Network", "Available IoSystem: '" + ioSystem2.Name + "' on subnet '" + subnet2.Name + "', Controller: '" + (ioSystemControllerName2 ?? "unknown") + "'"));
					}
				}
				foreach (Subnet subnet3 in ((ProjectBase)project).Subnets)
				{
					foreach (IoSystem ioSystem3 in subnet3.IoSystems)
					{
						string ioSystemControllerName3 = GetIoSystemControllerName(ioSystem3);
						if (!string.IsNullOrEmpty(ioSystemControllerName3) && !string.IsNullOrEmpty(ioControllerDeviceName) && (ioSystemControllerName3 == ioControllerDeviceName || ioSystemControllerName3.Contains(ioControllerDeviceName) || ioControllerDeviceName.Contains(ioSystemControllerName3)))
						{
							val = ioSystem3;
							val2 = subnet3;
							_messages.Add(ExportMessage.Success(deviceDisplayName, "Network", "Matched IoSystem '" + ioSystem3.Name + "' to IoController '" + ioSystemControllerName3 + "'"));
							break;
						}
					}
					if (val != null)
					{
						break;
					}
				}
				if (val == null)
				{
					_messages.Add(ExportMessage.Info(deviceDisplayName, "Network", "No IoSystem found for IoController '" + ioControllerDeviceName + "', searching by IoSystem name '" + ioSystemName + "'"));
					foreach (Subnet subnet4 in ((ProjectBase)project).Subnets)
					{
						foreach (IoSystem ioSystem4 in subnet4.IoSystems)
						{
							if (ioSystem4.Name == ioSystemName)
							{
								val = ioSystem4;
								val2 = subnet4;
								_messages.Add(ExportMessage.Info(deviceDisplayName, "Network", "Matched IoSystem by name '" + ioSystemName + "' (WARNING: IoController may not match!)"));
								break;
							}
						}
						if (val != null)
						{
							break;
						}
					}
				}
			}
			if (val == null || val2 == null)
			{
				_messages.Add(ExportMessage.Warning(deviceDisplayName, "Network", "IoSystem '" + ioSystemName + "' for IoController '" + ioControllerDeviceName + "' not found in project"));
				return;
			}
			_messages.Add(ExportMessage.Info(deviceDisplayName, "Network", "Using IoSystem '" + val.Name + "' on subnet '" + val2.Name + "'"));
			NetworkInterface val4 = FindDeviceNetworkInterface(device);
			if (val4 == null)
			{
				_messages.Add(ExportMessage.Warning(deviceDisplayName, "Network", "No network interface found on device"));
				return;
			}
			bool flag = false;
			foreach (Node node in val4.Nodes)
			{
				try
				{
					if (node.ConnectedSubnet != null)
					{
						if (node.ConnectedSubnet == val2)
						{
							flag = true;
							_messages.Add(ExportMessage.Info(deviceDisplayName, "Network", "Node already connected to subnet '" + val2.Name + "'"));
						}
						else
						{
							_messages.Add(ExportMessage.Warning(deviceDisplayName, "Network", "Node connected to different subnet: " + node.ConnectedSubnet.Name));
						}
					}
					else
					{
						node.ConnectToSubnet(val2);
						flag = true;
						_messages.Add(ExportMessage.Success(deviceDisplayName, "Network", "Connected node to subnet '" + val2.Name + "'"));
					}
				}
				catch (Exception ex)
				{
					_messages.Add(ExportMessage.Warning(deviceDisplayName, "Network", "Could not connect node to subnet: " + ex.Message));
					continue;
				}
				break;
			}
			if (!flag)
			{
				_messages.Add(ExportMessage.Warning(deviceDisplayName, "Network", "Could not connect device to subnet, skipping IoSystem connection"));
				return;
			}
			IoConnector val5 = null;
			using (IEnumerator<IoConnector> enumerator4 = val4.IoConnectors.GetEnumerator())
			{
				if (enumerator4.MoveNext())
				{
					val5 = enumerator4.Current;
				}
			}
			if (val5 == null)
			{
				_messages.Add(ExportMessage.Warning(deviceDisplayName, "Network", "No IoConnector found on network interface"));
				return;
			}
			if (val5.ConnectedToIoSystem != null)
			{
				if (val5.ConnectedToIoSystem.Name == ioSystemName)
				{
					_messages.Add(ExportMessage.Info(deviceDisplayName, "Network", "Device already connected to IoSystem '" + ioSystemName + "'"));
				}
				else
				{
					_messages.Add(ExportMessage.Warning(deviceDisplayName, "Network", "Device already connected to different IoSystem: " + val5.ConnectedToIoSystem.Name));
				}
			}
			else
			{
				val5.ConnectToIoSystem(val);
				_messages.Add(ExportMessage.Success(deviceDisplayName, "Network", "Connected to IoSystem '" + ioSystemName + "'"));
			}
			if (!string.IsNullOrEmpty(pnDeviceNumberStr) && int.TryParse(pnDeviceNumberStr, out var result))
			{
				try
				{
					((IEngineeringObject)val5).SetAttribute("PnDeviceNumber", (object)result);
					_messages.Add(ExportMessage.Info(deviceDisplayName, "Network", $"Set PnDeviceNumber to {result}"));
				}
				catch (Exception ex2)
				{
					_messages.Add(ExportMessage.Warning(deviceDisplayName, "Network", "Could not set PnDeviceNumber: " + ex2.Message));
				}
			}
			if (string.IsNullOrEmpty(pnDeviceName))
			{
				return;
			}
			try
			{
				DeviceItem val6 = FindNetworkInterfaceDeviceItem(device);
				if (val6 != null)
				{
					((HardwareObject)val6).SetAttribute("PnDeviceName", (object)pnDeviceName);
					_messages.Add(ExportMessage.Info(deviceDisplayName, "Network", "Set PnDeviceName to '" + pnDeviceName + "'"));
				}
			}
			catch (Exception ex3)
			{
				_messages.Add(ExportMessage.Warning(deviceDisplayName, "Network", "Could not set PnDeviceName: " + ex3.Message));
			}
		}
		catch (Exception ex4)
		{
			_messages.Add(ExportMessage.Error(deviceDisplayName, "Network", "Failed to connect to IoSystem: " + ex4.Message));
		}
	}

	private IoSystem? FindIoSystemOnDevice(Device device, string? ioSystemName)
	{
		_messages.Add(ExportMessage.Info(DeviceItemHelper.GetDeviceDisplayName(device), "Network", "Searching for IoSystem on device, name filter: '" + (ioSystemName ?? "any") + "'"));
		return FindIoSystemOnDeviceRecursive(((HardwareObject)device).DeviceItems, ioSystemName, DeviceItemHelper.GetDeviceDisplayName(device));
	}

	private IoSystem? FindIoSystemOnDeviceRecursive(DeviceItemComposition items, string? ioSystemName, string deviceDisplayName)
	{
		foreach (DeviceItem item in items)
		{
			try
			{
				NetworkInterface service = item.GetService<NetworkInterface>();
				if (service != null)
				{
					_messages.Add(ExportMessage.Info(deviceDisplayName, "Network", "Found NetworkInterface on '" + ((HardwareObject)item).Name + "'"));
					if (service.IoControllers != null)
					{
						int num = 0;
						foreach (IoController ioController in service.IoControllers)
						{
							num++;
							IoSystem ioSystem = ioController.IoSystem;
							_messages.Add(ExportMessage.Info(deviceDisplayName, "Network", string.Format("Found IoController #{0}, IoSystem: {1}", num, (ioSystem != null) ? ioSystem.Name : "null")));
							if (ioSystem != null && (string.IsNullOrEmpty(ioSystemName) || ioSystem.Name == ioSystemName))
							{
								_messages.Add(ExportMessage.Info(deviceDisplayName, "Network", "Matched IoSystem '" + ioSystem.Name + "'"));
								return ioSystem;
							}
						}
						if (num == 0)
						{
							_messages.Add(ExportMessage.Info(deviceDisplayName, "Network", "No IoControllers found on NetworkInterface '" + ((HardwareObject)item).Name + "'"));
						}
					}
					else
					{
						_messages.Add(ExportMessage.Info(deviceDisplayName, "Network", "IoControllers collection is null on '" + ((HardwareObject)item).Name + "'"));
					}
				}
			}
			catch (Exception ex)
			{
				_messages.Add(ExportMessage.Info(deviceDisplayName, "Network", "Error checking item '" + ((HardwareObject)item).Name + "': " + ex.Message));
			}
			if (((HardwareObject)item).DeviceItems.Count > 0)
			{
				IoSystem val = FindIoSystemOnDeviceRecursive(((HardwareObject)item).DeviceItems, ioSystemName, deviceDisplayName);
				if (val != null)
				{
					return val;
				}
			}
		}
		return null;
	}

	private string? GetIoSystemControllerName(IoSystem ioSystem)
	{
		try
		{
			IEngineeringObject val = (IEngineeringObject)(object)ioSystem;
			while (val != null)
			{
				Device val2 = (Device)(object)((val is Device) ? val : null);
				if (val2 != null)
				{
					return DeviceItemHelper.GetDeviceDisplayName(val2);
				}
				try
				{
					val = ((IEngineeringInstance)val).Parent;
				}
				catch
				{
					break;
				}
			}
		}
		catch
		{
		}
		return null;
	}

	private bool IsProfibusAddress(string address, string interfaceType)
	{
		if (interfaceType.Contains("Profibus", StringComparison.OrdinalIgnoreCase) || interfaceType.Contains("DP", StringComparison.OrdinalIgnoreCase))
		{
			return true;
		}
		if (!address.Contains(".") && int.TryParse(address, out var result))
		{
			if (result >= 1)
			{
				return result <= 126;
			}
			return false;
		}
		return false;
	}

	private NetworkInterface? FindProfibusInterface(Device device)
	{
		return FindNetworkInterfaceByType(((HardwareObject)device).DeviceItems, "Profibus");
	}

	private DeviceItem? FindProfibusDeviceItem(Device device)
	{
		return FindDeviceItemByInterfaceType(((HardwareObject)device).DeviceItems, "Profibus");
	}
}
