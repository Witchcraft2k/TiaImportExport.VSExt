using System;
using System.Collections.Generic;
using System.Linq;
using System.Xml;
using Siemens.Engineering;
using Siemens.Engineering.HW;
using TiaOpennessWrapper.Models;
using TiaOpennessWrapper.Services.Import;

namespace TiaOpennessWrapper.Services.Export;

internal class DeviceExportHelper
{
	private readonly List<ExportMessage> _messages;

	public DeviceExportHelper(List<ExportMessage> messages)
	{
		_messages = messages;
	}

	public Device? FindDeviceByName(ProjectBase project, string? displayName, string? fullName)
	{
		if (string.IsNullOrEmpty(displayName) && string.IsNullOrEmpty(fullName))
		{
			return null;
		}
		if (!string.IsNullOrEmpty(displayName))
		{
			foreach (Device device in project.Devices)
			{
				if (DeviceItemHelper.GetDeviceDisplayName(device) == displayName)
				{
					return device;
				}
			}
		}
		if (!string.IsNullOrEmpty(fullName))
		{
			Device val = ((IEnumerable<Device>)project.Devices).FirstOrDefault((Device d) => ((HardwareObject)d).Name == fullName);
			if (val != null)
			{
				return val;
			}
		}
		foreach (Device device2 in project.Devices)
		{
			try
			{
				if (FindMatchingDeviceItemName(((HardwareObject)device2).DeviceItems, displayName))
				{
					return device2;
				}
			}
			catch
			{
			}
		}
		try
		{
			IEnumerable<Device> enumerable;
			if (!string.IsNullOrEmpty(displayName))
			{
				DeviceSystemGroup ungroupedDevicesGroup = project.UngroupedDevicesGroup;
				enumerable = (IEnumerable<Device>)((ungroupedDevicesGroup != null) ? ((DeviceGroup)ungroupedDevicesGroup).Devices : null);
				foreach (Device item in enumerable ?? Enumerable.Empty<Device>())
				{
					if (DeviceItemHelper.GetDeviceDisplayName(item) == displayName)
					{
						return item;
					}
				}
			}
			if (!string.IsNullOrEmpty(fullName))
			{
				DeviceSystemGroup ungroupedDevicesGroup2 = project.UngroupedDevicesGroup;
				Device val2 = ((ungroupedDevicesGroup2 == null) ? null : ((IEnumerable<Device>)((DeviceGroup)ungroupedDevicesGroup2).Devices)?.FirstOrDefault((Device d) => ((HardwareObject)d).Name == fullName));
				if (val2 != null)
				{
					return val2;
				}
			}
			DeviceSystemGroup ungroupedDevicesGroup3 = project.UngroupedDevicesGroup;
			enumerable = (IEnumerable<Device>)((ungroupedDevicesGroup3 != null) ? ((DeviceGroup)ungroupedDevicesGroup3).Devices : null);
			foreach (Device item2 in enumerable ?? Enumerable.Empty<Device>())
			{
				if (FindMatchingDeviceItemName(((HardwareObject)item2).DeviceItems, displayName))
				{
					return item2;
				}
			}
		}
		catch
		{
		}
		return null;
	}

	private bool FindMatchingDeviceItemName(DeviceItemComposition items, string targetName)
	{
		foreach (DeviceItem item in items)
		{
			if (((HardwareObject)item).Name == targetName)
			{
				return true;
			}
			if (((HardwareObject)item).DeviceItems.Count > 0 && FindMatchingDeviceItemName(((HardwareObject)item).DeviceItems, targetName))
			{
				return true;
			}
		}
		return false;
	}

	public bool CreateNewDevice(ProjectBase project, string deviceName, string typeIdentifier, XmlNode deviceNode, ModuleExportHelper moduleHelper, NetworkExportHelper networkHelper)
	{
		try
		{
			_messages.Add(ExportMessage.Info(deviceName, "Create", "Attempting to create device with TypeIdentifier: " + typeIdentifier));
			Device val = project.Devices.CreateWithItem(typeIdentifier, deviceName, (string)null);
			if (val != null)
			{
				_messages.Add(ExportMessage.Success(deviceName, "Create", "Created device with type: " + typeIdentifier));
				UpdateDeviceConfiguration(project, val, deviceNode, new HwConfigExportToTiaOptions
				{
					UpdateExisting = true,
					ImportNetworkConfig = true
				}, moduleHelper, networkHelper);
				return true;
			}
			return false;
		}
		catch (Exception ex)
		{
			_messages.Add(ExportMessage.Error(deviceName, "Create", "Failed to create device: " + ex.Message));
			return false;
		}
	}

	public bool UpdateDeviceConfiguration(ProjectBase project, Device device, XmlNode deviceNode, HwConfigExportToTiaOptions options, ModuleExportHelper moduleHelper, NetworkExportHelper networkHelper)
	{
		try
		{
			string text = deviceNode.Attributes?["Comment"]?.Value;
			if (!string.IsNullOrEmpty(text))
			{
				try
				{
					((HardwareObject)device).SetAttribute("Comment", (object)text);
					_messages.Add(ExportMessage.Info(((HardwareObject)device).Name, "Attribute", "Updated device comment"));
				}
				catch
				{
				}
			}
			XmlNode xmlNode = XmlExportHelper.FindDeviceItemsNode(deviceNode);
			if (xmlNode != null)
			{
				moduleHelper.PlugMissingModules(device, xmlNode);
				moduleHelper.UpdateDeviceItems(((HardwareObject)device).DeviceItems, xmlNode, options);
			}
			if (options.ImportNetworkConfig)
			{
				networkHelper.ConfigureDeviceNetwork(project, device, deviceNode);
			}
			return true;
		}
		catch (Exception ex)
		{
			_messages.Add(ExportMessage.Warning(((HardwareObject)device).Name, "Update", "Could not fully update device: " + ex.Message));
			return false;
		}
	}

	public string? ExtractOrderNumberFromDeviceNode(XmlNode deviceNode)
	{
		try
		{
			string text = SearchForOrderNumberByClassification(deviceNode, "HM");
			if (!string.IsNullOrEmpty(text))
			{
				return text;
			}
			string text2 = SearchForOrderNumber(deviceNode, skipPlaceholders: true);
			if (!string.IsNullOrEmpty(text2))
			{
				return text2;
			}
			string text3 = deviceNode.Attributes?["OrderNumber"]?.Value;
			if (text3 != null && text3.Length > 0)
			{
				return text3;
			}
			return SearchForOrderNumber(deviceNode, skipPlaceholders: false);
		}
		catch
		{
			return null;
		}
	}

	private string? SearchForOrderNumberByClassification(XmlNode node, string classification)
	{
		foreach (XmlNode childNode in node.ChildNodes)
		{
			if (childNode.Name == "DeviceItem" || childNode.LocalName == "DeviceItem")
			{
				if (childNode.Attributes?["Classification"]?.Value == classification)
				{
					string text = childNode.Attributes?["OrderNumber"]?.Value;
					if (text != null && text.Length > 0 && !text.Contains("*"))
					{
						return text;
					}
				}
				string text2 = SearchForOrderNumberByClassification(childNode, classification);
				if (!string.IsNullOrEmpty(text2))
				{
					return text2;
				}
			}
			else if (childNode.Name == "DeviceItems" || childNode.LocalName == "DeviceItems")
			{
				string text3 = SearchForOrderNumberByClassification(childNode, classification);
				if (!string.IsNullOrEmpty(text3))
				{
					return text3;
				}
			}
		}
		return null;
	}

	private string? SearchForOrderNumber(XmlNode node, bool skipPlaceholders)
	{
		foreach (XmlNode childNode in node.ChildNodes)
		{
			if (childNode.Name == "DeviceItem" || childNode.LocalName == "DeviceItem")
			{
				string text = childNode.Attributes?["OrderNumber"]?.Value;
				if (text != null && text.Length > 0 && (!skipPlaceholders || !text.Contains("*")))
				{
					return text;
				}
				string text2 = SearchForOrderNumber(childNode, skipPlaceholders);
				if (!string.IsNullOrEmpty(text2))
				{
					return text2;
				}
			}
			else if (childNode.Name == "DeviceItems" || childNode.LocalName == "DeviceItems")
			{
				string text3 = SearchForOrderNumber(childNode, skipPlaceholders);
				if (!string.IsNullOrEmpty(text3))
				{
					return text3;
				}
			}
		}
		return null;
	}

	public string? ExtractFirmwareVersionFromDeviceNode(XmlNode deviceNode)
	{
		try
		{
			string text = SearchForFirmwareVersionByClassification(deviceNode, "HM");
			if (!string.IsNullOrEmpty(text))
			{
				return text;
			}
			string text2 = deviceNode.Attributes?["FirmwareVersion"]?.Value;
			if (!string.IsNullOrEmpty(text2))
			{
				return text2;
			}
			return SearchForFirmwareVersion(deviceNode);
		}
		catch
		{
			return null;
		}
	}

	private string? SearchForFirmwareVersionByClassification(XmlNode node, string classification)
	{
		foreach (XmlNode childNode in node.ChildNodes)
		{
			if (childNode.Name == "DeviceItem" || childNode.LocalName == "DeviceItem")
			{
				if (childNode.Attributes?["Classification"]?.Value == classification)
				{
					string text = childNode.Attributes?["FirmwareVersion"]?.Value;
					if (!string.IsNullOrEmpty(text))
					{
						return text;
					}
				}
				string text2 = SearchForFirmwareVersionByClassification(childNode, classification);
				if (!string.IsNullOrEmpty(text2))
				{
					return text2;
				}
			}
			else if (childNode.Name == "DeviceItems" || childNode.LocalName == "DeviceItems")
			{
				string text3 = SearchForFirmwareVersionByClassification(childNode, classification);
				if (!string.IsNullOrEmpty(text3))
				{
					return text3;
				}
			}
		}
		return null;
	}

	private string? SearchForFirmwareVersion(XmlNode node)
	{
		foreach (XmlNode childNode in node.ChildNodes)
		{
			if (childNode.Name == "DeviceItem" || childNode.LocalName == "DeviceItem")
			{
				string text = childNode.Attributes?["FirmwareVersion"]?.Value;
				if (!string.IsNullOrEmpty(text))
				{
					return text;
				}
				string text2 = SearchForFirmwareVersion(childNode);
				if (!string.IsNullOrEmpty(text2))
				{
					return text2;
				}
			}
			else if (childNode.Name == "DeviceItems" || childNode.LocalName == "DeviceItems")
			{
				string text3 = SearchForFirmwareVersion(childNode);
				if (!string.IsNullOrEmpty(text3))
				{
					return text3;
				}
			}
		}
		return null;
	}
}
