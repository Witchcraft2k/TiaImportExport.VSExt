using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Reflection;
using System.Xml;
using Siemens.Engineering;
using Siemens.Engineering.HW;
using Siemens.Engineering.HW.Features;
using TiaOpennessWrapper.Models;
using TiaOpennessWrapper.Services.Import;

namespace TiaOpennessWrapper.Services.Export;

internal class ModuleExportHelper
{
	private const int SkippedModulePosition = 127;

	private readonly List<ExportMessage> _messages;

	public ModuleExportHelper(List<ExportMessage> messages)
	{
		_messages = messages;
	}

	public void PlugMissingModules(Device device, XmlNode deviceItemsNode)
	{
		string deviceDisplayName = DeviceItemHelper.GetDeviceDisplayName(device);
		try
		{
			DeviceItem val = FindRackRecursive(((HardwareObject)device).DeviceItems);
			if (val == null)
			{
				_messages.Add(ExportMessage.Warning(deviceDisplayName, "PlugModules", "Could not find rack to plug modules"));
				return;
			}
			_messages.Add(ExportMessage.Info(((HardwareObject)val).Name, "PlugModules", "Found rack: " + ((HardwareObject)val).Name));
			List<(XmlNode, int, string, string, string)> list = new List<(XmlNode, int, string, string, string)>();
			FindIoModulesRecursive(deviceItemsNode, list);
			_messages.Add(ExportMessage.Info(deviceDisplayName, "PlugModules", $"Found {list.Count} I/O modules in XML"));
			foreach (var item5 in list)
			{
				int item = item5.Item2;
				string item2 = item5.Item3;
				string item3 = item5.Item4;
				string item4 = item5.Item5;
				try
				{
					if (CheckModuleExistsAtPosition(val, item))
					{
						_messages.Add(ExportMessage.Info(item4 ?? item2, "PlugModules", $"Module at position {item} already exists"));
						continue;
					}
					string text = "OrderNumber:" + item2;
					if (!string.IsNullOrEmpty(item3))
					{
						text = text + "/" + item3;
					}
					try
					{
						_messages.Add(ExportMessage.Info(item4 ?? item2, "PlugModules", $"Plugging module at position {item}: {text}"));
						if (((HardwareObject)val).PlugNew(text, item4 ?? $"Module_{item}", item) != null)
						{
							_messages.Add(ExportMessage.Success(item4 ?? item2, "PlugModules", $"Successfully plugged module at position {item}"));
						}
					}
					catch (Exception ex)
					{
						_messages.Add(ExportMessage.Warning(item4 ?? item2, "PlugModules", $"Could not plug module at position {item}: {ex.Message}"));
					}
				}
				catch (Exception ex2)
				{
					_messages.Add(ExportMessage.Warning("Module", "PlugModules", "Error processing module: " + ex2.Message));
				}
			}
		}
		catch (Exception ex3)
		{
			_messages.Add(ExportMessage.Warning(((HardwareObject)device).Name, "PlugModules", "Error plugging modules: " + ex3.Message));
		}
	}

	private DeviceItem? FindRackRecursive(DeviceItemComposition items)
	{
		foreach (DeviceItem item in items)
		{
			try
			{
				string text = ((HardwareObject)item).GetAttribute("TypeName")?.ToString();
				_messages.Add(ExportMessage.Info(((HardwareObject)item).Name, "FindRack", "Checking item: " + ((HardwareObject)item).Name + ", TypeName: " + (text ?? "null")));
				if (text == "Rack" || text == "Rail" || ((HardwareObject)item).Name.Contains("Rail"))
				{
					return item;
				}
				if (((HardwareObject)item).DeviceItems.Count > 0)
				{
					DeviceItem val = FindRackRecursive(((HardwareObject)item).DeviceItems);
					if (val != null)
					{
						return val;
					}
				}
			}
			catch
			{
			}
		}
		return null;
	}

	private void FindIoModulesRecursive(XmlNode node, List<(XmlNode Node, int Position, string OrderNumber, string? FirmwareVersion, string? Name)> modules)
	{
		foreach (XmlNode childNode in node.ChildNodes)
		{
			if (!(childNode.Name == "DeviceItem") && !(childNode.LocalName == "DeviceItem"))
			{
				continue;
			}
			string text = childNode.Attributes?["OrderNumber"]?.Value;
			string s = childNode.Attributes?["PositionNumber"]?.Value;
			string text2 = childNode.Attributes?["Name"]?.Value;
			string item = childNode.Attributes?["FirmwareVersion"]?.Value;
			string text3 = childNode.Attributes?["Classification"]?.Value;
			string text4 = childNode.Attributes?["TypeName"]?.Value;
			if (!string.IsNullOrEmpty(text) && !text.Contains("*") && int.TryParse(s, out var result) && result >= 1 && text3 != "HM" && text4 != "Rack")
			{
				if (result == 127)
				{
					_messages.Add(ExportMessage.Info(text2 ?? text, "FindModules", $"Skipping module at reserved position {result}"));
					continue;
				}
				_messages.Add(ExportMessage.Info(text2 ?? text, "FindModules", string.Format("Found I/O module: {0} at position {1}, Classification: {2}", text2 ?? text, result, text3 ?? "none")));
				modules.Add((childNode, result, text, item, text2));
			}
			foreach (XmlNode childNode2 in childNode.ChildNodes)
			{
				if (childNode2.Name == "DeviceItems" || childNode2.LocalName == "DeviceItems")
				{
					FindIoModulesRecursive(childNode2, modules);
				}
			}
		}
	}

	private bool CheckModuleExistsAtPosition(DeviceItem rack, int position)
	{
		foreach (DeviceItem deviceItem in ((HardwareObject)rack).DeviceItems)
		{
			try
			{
				object attribute = ((HardwareObject)deviceItem).GetAttribute("PositionNumber");
				if (attribute != null && Convert.ToInt32(attribute) == position)
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

	public void UpdateDeviceItems(DeviceItemComposition items, XmlNode xmlItemsNode, HwConfigExportToTiaOptions options)
	{
		List<XmlNode> deviceItemNodes = XmlExportHelper.GetDeviceItemNodes(xmlItemsNode);
		string namespaceURI = xmlItemsNode.NamespaceURI;
		_messages.Add(ExportMessage.Info("UpdateDeviceItems", "Debug", $"Processing {deviceItemNodes.Count} XML items against {items.Count} device items"));
		foreach (XmlNode item in deviceItemNodes)
		{
			string itemName = item.Attributes?["Name"]?.Value;
			if (string.IsNullOrEmpty(itemName))
			{
				continue;
			}
			DeviceItem val = ((IEnumerable<DeviceItem>)items).FirstOrDefault((DeviceItem i) => ((HardwareObject)i).Name == itemName);
			if (val == null)
			{
				if (int.TryParse(item.Attributes?["PositionNumber"]?.Value, out var position))
				{
					val = ((IEnumerable<DeviceItem>)items).FirstOrDefault(delegate(DeviceItem i)
					{
						try
						{
							return (int)((HardwareObject)i).GetAttribute("PositionNumber") == position;
						}
						catch
						{
							return false;
						}
					});
				}
			}
			if (val == null)
			{
				_messages.Add(ExportMessage.Warning(itemName ?? "Unknown", "UpdateDeviceItems", "Could not find matching device item for '" + itemName + "'"));
				continue;
			}
			_messages.Add(ExportMessage.Info(((HardwareObject)val).Name, "UpdateDeviceItems", "Found matching device item: " + ((HardwareObject)val).Name));
			try
			{
				string text = item.Attributes?["Comment"]?.Value;
				if (!string.IsNullOrEmpty(text))
				{
					((HardwareObject)val).SetAttribute("Comment", (object)text);
				}
			}
			catch
			{
			}
			ConfigureDeviceItemAddresses(val, item);
			ConfigureDeviceItemChannels(val, item);
			XmlNode xmlNode = null;
			if (!string.IsNullOrEmpty(namespaceURI))
			{
				XmlNamespaceManager xmlNamespaceManager = new XmlNamespaceManager(item.OwnerDocument.NameTable);
				xmlNamespaceManager.AddNamespace("hw", namespaceURI);
				xmlNode = item.SelectSingleNode("hw:DeviceItems", xmlNamespaceManager);
			}
			if (xmlNode == null)
			{
				xmlNode = item.SelectSingleNode("DeviceItems");
			}
			if (xmlNode == null)
			{
				foreach (XmlNode childNode in item.ChildNodes)
				{
					if (childNode.Name == "DeviceItems" || childNode.LocalName == "DeviceItems")
					{
						xmlNode = childNode;
						break;
					}
				}
			}
			if (xmlNode != null && ((HardwareObject)val).DeviceItems.Count > 0)
			{
				_messages.Add(ExportMessage.Info(((HardwareObject)val).Name, "UpdateDeviceItems", $"Recursively processing {((HardwareObject)val).DeviceItems.Count} child device items"));
				UpdateDeviceItems(((HardwareObject)val).DeviceItems, xmlNode, options);
			}
		}
	}

	private void ConfigureDeviceItemAddresses(DeviceItem deviceItem, XmlNode xmlItem)
	{
		try
		{
			XmlNode xmlNode = null;
			foreach (XmlNode childNode in xmlItem.ChildNodes)
			{
				if (childNode.Name == "Addresses" || childNode.LocalName == "Addresses")
				{
					xmlNode = childNode;
					break;
				}
			}
			if (xmlNode == null)
			{
				_messages.Add(ExportMessage.Info(((HardwareObject)deviceItem).Name, "Address", "No Addresses element found in XML"));
				return;
			}
			if (xmlNode.Attributes?["Count"]?.Value == "0")
			{
				_messages.Add(ExportMessage.Info(((HardwareObject)deviceItem).Name, "Address", "Addresses Count=0 in XML, skipping"));
				return;
			}
			int cardPositionInRack = GetCardPositionInRack(deviceItem, xmlItem);
			_messages.Add(ExportMessage.Info(((HardwareObject)deviceItem).Name, "Address", $"Processing addresses for device item at position {cardPositionInRack}"));
			IEnumerable<object> deviceItemAddresses = GetDeviceItemAddresses(deviceItem);
			if (deviceItemAddresses == null || !deviceItemAddresses.Any())
			{
				_messages.Add(ExportMessage.Warning(((HardwareObject)deviceItem).Name, "Address", "No addresses found on device item"));
				return;
			}
			_messages.Add(ExportMessage.Info(((HardwareObject)deviceItem).Name, "Address", $"Found {deviceItemAddresses.Count()} address(es) on device item"));
			int num = 0;
			foreach (XmlNode childNode2 in xmlNode.ChildNodes)
			{
				if (childNode2.Name != "Item" && childNode2.LocalName != "Item")
				{
					continue;
				}
				num++;
				string text = childNode2.Attributes?["IoType"]?.Value;
				string text2 = childNode2.Attributes?["StartAddress"]?.Value;
				string text3 = childNode2.Attributes?["Length"]?.Value;
				_messages.Add(ExportMessage.Info(((HardwareObject)deviceItem).Name, "Address", "Found address item in XML: IoType=" + text + ", StartAddress=" + text2 + ", Length=" + text3));
				if (text == "Diagnosis")
				{
					_messages.Add(ExportMessage.Info(((HardwareObject)deviceItem).Name, "Address", "Skipping Diagnosis address"));
				}
				else
				{
					if (text2 == "-1" || !int.TryParse(text2, out var result) || !ShouldSetStartAddress(text, cardPositionInRack, result, ((HardwareObject)deviceItem).Name))
					{
						continue;
					}
					bool flag = false;
					foreach (object item in deviceItemAddresses)
					{
						try
						{
							IEngineeringObject val = (IEngineeringObject)((item is IEngineeringObject) ? item : null);
							if (val == null)
							{
								continue;
							}
							string text4 = val.GetAttribute("IoType")?.ToString();
							_messages.Add(ExportMessage.Info(((HardwareObject)deviceItem).Name, "Address", "Checking TIA address object: IoType=" + text4));
							if (text != null && text4 != text)
							{
								continue;
							}
							flag = true;
							if (SetAddressStartAddress(val, result, ((HardwareObject)deviceItem).Name))
							{
								_messages.Add(ExportMessage.Success(((HardwareObject)deviceItem).Name, "Address", $"Set {text} StartAddress to {result} (card position: {cardPositionInRack})"));
							}
							break;
						}
						catch (Exception ex)
						{
							_messages.Add(ExportMessage.Warning(((HardwareObject)deviceItem).Name, "Address", "Error processing address: " + ex.Message));
						}
					}
					if (!flag)
					{
						_messages.Add(ExportMessage.Warning(((HardwareObject)deviceItem).Name, "Address", "No matching address found in TIA for IoType=" + text));
					}
				}
			}
			if (num == 0)
			{
				_messages.Add(ExportMessage.Info(((HardwareObject)deviceItem).Name, "Address", "No address items found in XML Addresses element"));
			}
		}
		catch (Exception ex2)
		{
			_messages.Add(ExportMessage.Warning(((HardwareObject)deviceItem).Name, "Address", "Could not configure addresses: " + ex2.Message));
		}
	}

	private IEnumerable<object>? GetDeviceItemAddresses(DeviceItem deviceItem)
	{
		try
		{
			PropertyInfo property = ((object)deviceItem).GetType().GetProperty("Addresses");
			if (property != null && property.GetValue(deviceItem) is IEnumerable source)
			{
				return source.Cast<object>();
			}
		}
		catch
		{
		}
		try
		{
			AddressController service = deviceItem.GetService<AddressController>();
			if (service != null)
			{
				PropertyInfo property2 = ((object)service).GetType().GetProperty("Addresses");
				if (property2 != null && property2.GetValue(service) is IEnumerable source2)
				{
					return source2.Cast<object>();
				}
			}
		}
		catch
		{
		}
		return null;
	}

	private bool SetAddressStartAddress(IEngineeringObject addressObj, int startAddress, string deviceName)
	{
		try
		{
			addressObj.SetAttribute("StartAddress", (object)startAddress);
			return true;
		}
		catch (Exception ex)
		{
			_messages.Add(ExportMessage.Info(deviceName, "Address", "SetAttribute approach failed: " + ex.Message));
		}
		try
		{
			PropertyInfo property = ((object)addressObj).GetType().GetProperty("StartAddress");
			if (property != null && property.CanWrite)
			{
				property.SetValue(addressObj, startAddress);
				return true;
			}
		}
		catch (Exception ex2)
		{
			_messages.Add(ExportMessage.Info(deviceName, "Address", "Property set approach failed: " + ex2.Message));
		}
		_messages.Add(ExportMessage.Warning(deviceName, "Address", $"Could not set StartAddress to {startAddress}"));
		return false;
	}

	private int GetCardPositionInRack(DeviceItem deviceItem, XmlNode xmlItem)
	{
		if (int.TryParse(xmlItem.Attributes?["PositionNumber"]?.Value, out var result))
		{
			return result;
		}
		try
		{
			object attribute = ((HardwareObject)deviceItem).GetAttribute("PositionNumber");
			if (attribute != null)
			{
				return Convert.ToInt32(attribute);
			}
		}
		catch
		{
		}
		return -1;
	}

	private bool ShouldSetStartAddress(string? ioType, int cardPosition, int startAddress, string deviceName)
	{
		if (cardPosition < 0)
		{
			_messages.Add(ExportMessage.Info(deviceName, "Address", string.Format("Card position unknown, setting {0} StartAddress to {1}", ioType ?? "unknown", startAddress)));
			return true;
		}
		if (string.IsNullOrEmpty(ioType))
		{
			_messages.Add(ExportMessage.Info(deviceName, "Address", $"IoType not specified for card at position {cardPosition}, allowing StartAddress {startAddress}"));
			return true;
		}
		if (cardPosition >= 2)
		{
			_messages.Add(ExportMessage.Info(deviceName, "Address", $"I/O card at position {cardPosition}: setting {ioType} StartAddress to {startAddress}"));
		}
		else
		{
			_messages.Add(ExportMessage.Warning(deviceName, "Address", $"Card at CPU position {cardPosition}: {ioType} StartAddress {startAddress} may not be applicable"));
		}
		string text = ioType?.ToUpperInvariant();
		if (!(text == "INPUT"))
		{
			if (text == "OUTPUT")
			{
				if (startAddress < 0)
				{
					_messages.Add(ExportMessage.Warning(deviceName, "Address", $"Invalid Output StartAddress {startAddress} for card at position {cardPosition}"));
					return false;
				}
			}
			else
			{
				_messages.Add(ExportMessage.Info(deviceName, "Address", $"Unknown IoType '{ioType}' for card at position {cardPosition}"));
			}
		}
		else if (startAddress < 0)
		{
			_messages.Add(ExportMessage.Warning(deviceName, "Address", $"Invalid Input StartAddress {startAddress} for card at position {cardPosition}"));
			return false;
		}
		return true;
	}

	private void ConfigureDeviceItemChannels(DeviceItem deviceItem, XmlNode xmlItem)
	{
		try
		{
			XmlNode xmlNode = null;
			foreach (XmlNode childNode in xmlItem.ChildNodes)
			{
				if (childNode.Name == "Channels" || childNode.LocalName == "Channels")
				{
					xmlNode = childNode;
					break;
				}
			}
			if (xmlNode == null || xmlNode.Attributes?["Count"]?.Value == "0")
			{
				return;
			}
			AddressController service = deviceItem.GetService<AddressController>();
			if (service == null)
			{
				return;
			}
			try
			{
				PropertyInfo property = ((object)service).GetType().GetProperty("Channels");
				if (!(property != null) || !(property.GetValue(service) is IEnumerable enumerable))
				{
					return;
				}
				Dictionary<int, XmlNode> dictionary = new Dictionary<int, XmlNode>();
				foreach (XmlNode childNode2 in xmlNode.ChildNodes)
				{
					if ((!(childNode2.Name != "Item") || !(childNode2.LocalName != "Item")) && int.TryParse(childNode2.Attributes?["Number"]?.Value, out var result))
					{
						dictionary[result] = childNode2;
					}
				}
				foreach (object item in enumerable)
				{
					try
					{
						IEngineeringObject val = (IEngineeringObject)((item is IEngineeringObject) ? item : null);
						if (val == null)
						{
							continue;
						}
						object attribute = val.GetAttribute("Number");
						if (attribute != null)
						{
							int num = Convert.ToInt32(attribute);
							if (dictionary.TryGetValue(num, out var value) && value != null)
							{
								ConfigureChannelFromXml(val, value, ((HardwareObject)deviceItem).Name, num);
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
		}
		catch (Exception ex)
		{
			_messages.Add(ExportMessage.Warning(((HardwareObject)deviceItem).Name, "Channels", "Could not configure channels: " + ex.Message));
		}
	}

	private void ConfigureChannelFromXml(IEngineeringObject channel, XmlNode xmlChannel, string deviceName, int channelNum)
	{
		string[] obj = new string[17]
		{
			"OperatingMode", "OperatingRange", "OperatingType", "ParameterSettings", "Smoothing", "InterferenceFrequencySuppression", "DiagnosticsNoSupplyVoltage", "DiagnosticsOverflow", "DiagnosticsUnderflow", "HardwareInterruptHighLimit1Active",
			"HardwareInterruptHighLimit2Active", "HardwareInterruptLowLimit1Active", "HardwareInterruptLowLimit2Active", "HardwareInterruptHighLimit1", "HardwareInterruptHighLimit2", "HardwareInterruptLowLimit1", "HardwareInterruptLowLimit2"
		};
		int num = 0;
		string[] array = obj;
		foreach (string text in array)
		{
			try
			{
				string text2 = xmlChannel.Attributes?[text]?.Value;
				if (!string.IsNullOrEmpty(text2))
				{
					object obj2 = text2;
					int result;
					double result2;
					if (text2 == "True" || text2 == "False")
					{
						obj2 = text2 == "True";
					}
					else if (int.TryParse(text2, out result))
					{
						obj2 = result;
					}
					else if (double.TryParse(text2, NumberStyles.Any, CultureInfo.InvariantCulture, out result2))
					{
						obj2 = result2;
					}
					channel.SetAttribute(text, obj2);
					num++;
				}
			}
			catch
			{
			}
		}
		if (num > 0)
		{
			_messages.Add(ExportMessage.Info(deviceName, "Channel", $"Configured {num} parameters for channel {channelNum}"));
		}
	}
}
