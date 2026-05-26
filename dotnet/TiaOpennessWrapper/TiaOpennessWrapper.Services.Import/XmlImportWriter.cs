using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Xml;
using Siemens.Engineering;
using Siemens.Engineering.HW;
using Siemens.Engineering.HW.Features;
using TiaOpennessWrapper.Models;

namespace TiaOpennessWrapper.Services.Import;

internal static class XmlImportWriter
{
	public static void WriteAllAttributes(XmlTextWriter writer, DeviceItem item, List<ExportMessage> messages)
	{
		//IL_0023: Unknown result type (might be due to invalid IL or missing references)
		//IL_0029: Invalid comparison between Unknown and I4
		try
		{
			HashSet<string> hashSet = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
			foreach (EngineeringAttributeInfo attributeInfo in ((IEngineeringObject)item).GetAttributeInfos())
			{
				try
				{
					if ((int)attributeInfo.AccessMode == 2)
					{
						continue;
					}
					string name = attributeInfo.Name;
					string text = DeviceItemHelper.SanitizeXmlName(name);
					if (hashSet.Contains(text))
					{
						continue;
					}
					object attribute = ((IEngineeringObject)item).GetAttribute(name);
					if (attribute != null)
					{
						string text2 = attribute.ToString();
						if (!string.IsNullOrEmpty(text2) && !text2.StartsWith("Siemens."))
						{
							writer.WriteAttributeString(text, text2);
							hashSet.Add(text);
						}
					}
				}
				catch
				{
				}
			}
		}
		catch (Exception ex)
		{
			messages.Add(ExportMessage.Warning(((HardwareObject)item).Name, "Attributes", "Could not enumerate all attributes: " + ex.Message));
		}
	}

	public static void WriteObjectPropertiesAsAttributes(XmlTextWriter writer, object obj)
	{
		try
		{
			PropertyInfo[] properties = obj.GetType().GetProperties(BindingFlags.Instance | BindingFlags.Public);
			foreach (PropertyInfo propertyInfo in properties)
			{
				try
				{
					if (!propertyInfo.CanRead || (typeof(IEnumerable).IsAssignableFrom(propertyInfo.PropertyType) && propertyInfo.PropertyType != typeof(string)))
					{
						continue;
					}
					object value = propertyInfo.GetValue(obj);
					if (value != null)
					{
						string text = value.ToString();
						if (!string.IsNullOrEmpty(text) && !text.StartsWith("Siemens.") && !text.StartsWith("System."))
						{
							writer.WriteAttributeString(DeviceItemHelper.SanitizeXmlName(propertyInfo.Name), text);
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

	public static void WriteAllAttributesFromObject(XmlTextWriter writer, object obj)
	{
		//IL_002e: Unknown result type (might be due to invalid IL or missing references)
		//IL_0034: Invalid comparison between Unknown and I4
		try
		{
			HashSet<string> hashSet = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
			IEngineeringObject val = (IEngineeringObject)((obj is IEngineeringObject) ? obj : null);
			if (val != null)
			{
				foreach (EngineeringAttributeInfo attributeInfo in val.GetAttributeInfos())
				{
					try
					{
						if ((int)attributeInfo.AccessMode != 2)
						{
							string text = DeviceItemHelper.SanitizeXmlName(attributeInfo.Name);
							if (!hashSet.Contains(text))
							{
								object attribute = val.GetAttribute(attributeInfo.Name);
								if (attribute != null)
								{
									string text2 = attribute.ToString();
									if (!string.IsNullOrEmpty(text2) && !text2.StartsWith("Siemens."))
									{
										writer.WriteAttributeString(text, text2);
										hashSet.Add(text);
									}
								}
							}
						}
					}
					catch
					{
					}
				}
				return;
			}
			PropertyInfo[] properties = obj.GetType().GetProperties(BindingFlags.Instance | BindingFlags.Public);
			foreach (PropertyInfo propertyInfo in properties)
			{
				try
				{
					if (!propertyInfo.CanRead)
					{
						continue;
					}
					string text3 = DeviceItemHelper.SanitizeXmlName(propertyInfo.Name);
					if (hashSet.Contains(text3))
					{
						continue;
					}
					object value = propertyInfo.GetValue(obj);
					if (value != null)
					{
						string text4 = value.ToString();
						if (!string.IsNullOrEmpty(text4) && !text4.StartsWith("Siemens."))
						{
							writer.WriteAttributeString(text3, text4);
							hashSet.Add(text3);
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

	public static void TryWriteAttribute(XmlTextWriter writer, DeviceItem item, string attributeName)
	{
		try
		{
			object attribute = ((HardwareObject)item).GetAttribute(attributeName);
			if (attribute != null)
			{
				writer.WriteAttributeString(attributeName, attribute.ToString());
			}
		}
		catch
		{
		}
	}

	public static void ExportDeviceItemsToXml(DeviceItemComposition items, XmlTextWriter writer, int level, List<ExportMessage> messages)
	{
		foreach (DeviceItem item in items)
		{
			try
			{
				writer.WriteStartElement("DeviceItem");
				WriteAllAttributes(writer, item, messages);
				string deviceItemClassification = DeviceItemHelper.GetDeviceItemClassification(item);
				TryWriteModuleInfo(writer, item, deviceItemClassification, messages);
				if (deviceItemClassification == "InterfaceModule" || ((HardwareObject)item).Name.Contains("PROFINET") || ((HardwareObject)item).Name.Contains("interface"))
				{
					TryWriteNetworkInfo(writer, item);
				}
				WriteServicesInfo(writer, item, messages);
				if (((HardwareObject)item).DeviceItems.Count > 0)
				{
					writer.WriteStartElement("DeviceItems");
					ExportDeviceItemsToXml(((HardwareObject)item).DeviceItems, writer, level + 1, messages);
					writer.WriteEndElement();
				}
				writer.WriteEndElement();
			}
			catch (Exception ex)
			{
				messages.Add(ExportMessage.Warning(((HardwareObject)item).Name, "DeviceItem", "Error exporting: " + ex.Message));
				try
				{
					writer.WriteComment("Error exporting item " + ((HardwareObject)item).Name + ": " + ex.Message);
				}
				catch
				{
				}
			}
		}
	}

	public static void TryWriteModuleInfo(XmlTextWriter writer, DeviceItem item, string classification, List<ExportMessage> messages)
	{
		try
		{
			if (!(classification == "CPU") && !(classification == "Head") && !DeviceItemHelper.IsCpuModule(item))
			{
				AddressController service = item.GetService<AddressController>();
				if (service != null)
				{
					TryWriteIoAddressesForModule(writer, service, item);
				}
			}
			TryWriteChannelConfiguration(writer, item, messages);
		}
		catch
		{
		}
	}

	public static void TryWriteSubItemAddresses(XmlTextWriter writer, DeviceItem subItem)
	{
		try
		{
			string[] array = new string[11]
			{
				"StartAddress", "Address", "LogicalAddress", "InputAddress", "OutputAddress", "IoAddress", "HwAddress", "InputStartAddress", "InputLength", "OutputStartAddress",
				"OutputLength"
			};
			foreach (string text in array)
			{
				try
				{
					object attribute = ((HardwareObject)subItem).GetAttribute(text);
					if (attribute != null && !string.IsNullOrEmpty(attribute.ToString()))
					{
						writer.WriteAttributeString(text, attribute.ToString());
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

	public static void TryWriteDirectIoAttributes(XmlTextWriter writer, DeviceItem item)
	{
		try
		{
			string[] array = new string[13]
			{
				"StartAddress", "EndAddress", "InputStartAddress", "InputEndAddress", "InputLength", "OutputStartAddress", "OutputEndAddress", "OutputLength", "LogicalAddress", "HwAddress",
				"Address", "AddressIn", "AddressOut"
			};
			foreach (string text in array)
			{
				try
				{
					object attribute = ((HardwareObject)item).GetAttribute(text);
					if (attribute != null && !string.IsNullOrEmpty(attribute.ToString()))
					{
						writer.WriteAttributeString(text, attribute.ToString());
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

	public static void TryWriteIoAddressesForModule(XmlTextWriter writer, AddressController addressController, DeviceItem parentItem)
	{
		//IL_02c4: Unknown result type (might be due to invalid IL or missing references)
		//IL_02ca: Invalid comparison between Unknown and I4
		//IL_03a1: Unknown result type (might be due to invalid IL or missing references)
		//IL_03a7: Invalid comparison between Unknown and I4
		try
		{
			HashSet<string> hashSet = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
			try
			{
				foreach (EngineeringAttributeInfo attributeInfo in ((IEngineeringObject)parentItem).GetAttributeInfos())
				{
					hashSet.Add(attributeInfo.Name);
				}
			}
			catch
			{
			}
			HashSet<string> hashSet2 = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
			{
				"StartAddress", "EndAddress", "Length", "Address", "InputAddress", "OutputAddress", "LogicalAddress", "InputStartAddress", "InputEndAddress", "InputLength",
				"OutputStartAddress", "OutputEndAddress", "OutputLength", "IoAddress", "HwAddress", "AddressIn", "AddressOut", "StartInputAddress", "StartOutputAddress", "RegisteredAddresses",
				"OwnedBy", "Parent"
			};
			IList<EngineeringAttributeInfo> attributeInfos = ((IEngineeringObject)addressController).GetAttributeInfos();
			bool flag = false;
			foreach (EngineeringAttributeInfo item in attributeInfos)
			{
				if (hashSet2.Contains(item.Name) && !hashSet.Contains(item.Name))
				{
					flag = true;
					break;
				}
			}
			PropertyInfo[] properties = ((object)addressController).GetType().GetProperties(BindingFlags.Instance | BindingFlags.Public);
			List<object> list = new List<object>();
			PropertyInfo[] array = properties;
			foreach (PropertyInfo propertyInfo in array)
			{
				try
				{
					if (!typeof(IEnumerable).IsAssignableFrom(propertyInfo.PropertyType) || !(propertyInfo.PropertyType != typeof(string)) || !(propertyInfo.GetValue(addressController) is IEnumerable enumerable))
					{
						continue;
					}
					foreach (object item2 in enumerable)
					{
						list.Add(item2);
					}
				}
				catch
				{
				}
			}
			if (!flag && list.Count == 0)
			{
				return;
			}
			writer.WriteStartElement("Addresses");
			writer.WriteAttributeString("Count", list.Count.ToString());
			foreach (EngineeringAttributeInfo item3 in attributeInfos)
			{
				try
				{
					if ((int)item3.AccessMode == 2 || (hashSet.Contains(item3.Name) && !hashSet2.Contains(item3.Name)))
					{
						continue;
					}
					object attribute = ((IEngineeringObject)addressController).GetAttribute(item3.Name);
					if (attribute != null)
					{
						string text = attribute.ToString();
						if (!string.IsNullOrEmpty(text) && !text.StartsWith("Siemens."))
						{
							writer.WriteAttributeString(DeviceItemHelper.SanitizeXmlName(item3.Name), text);
						}
					}
				}
				catch
				{
				}
			}
			foreach (object item4 in list)
			{
				try
				{
					writer.WriteStartElement("Address");
					IEngineeringObject val = (IEngineeringObject)((item4 is IEngineeringObject) ? item4 : null);
					if (val != null)
					{
						foreach (EngineeringAttributeInfo attributeInfo2 in val.GetAttributeInfos())
						{
							try
							{
								if ((int)attributeInfo2.AccessMode == 2)
								{
									continue;
								}
								object attribute2 = val.GetAttribute(attributeInfo2.Name);
								if (attribute2 != null)
								{
									string text2 = attribute2.ToString();
									if (!string.IsNullOrEmpty(text2) && !text2.StartsWith("Siemens."))
									{
										writer.WriteAttributeString(DeviceItemHelper.SanitizeXmlName(attributeInfo2.Name), text2);
									}
								}
							}
							catch
							{
							}
						}
					}
					else
					{
						WriteObjectPropertiesAsAttributes(writer, item4);
					}
					writer.WriteEndElement();
				}
				catch
				{
				}
			}
			writer.WriteEndElement();
		}
		catch
		{
		}
	}

	[Obsolete("Use TryWriteIoAddressesForModule instead")]
	public static void TryWriteAddressControllerInfo(XmlTextWriter writer, AddressController addressController)
	{
	}

	public static void TryWriteChannelConfiguration(XmlTextWriter writer, DeviceItem item, List<ExportMessage> messages)
	{
		try
		{
			string[] obj = new string[21]
			{
				"InputDelay", "OutputDelay", "DiagnosticsInterruptEnabled", "ProcessInterruptEnabled", "InputFilterTime", "OutputReactionTime", "MeasurementType", "MeasuringRange", "MeasuringRangeUnit", "TemperatureCoefficient",
				"SmoothingFilter", "WireBreakDetection", "OpenCircuitDetection", "Calibration", "Resolution", "ChannelCount", "DiagnosticsEnabled", "OperatingMode", "ModuleMode", "FailSafeValue",
				"SubstituteValue"
			};
			bool flag = false;
			string[] array = obj;
			foreach (string text in array)
			{
				try
				{
					object attribute = ((IEngineeringObject)item).GetAttribute(text);
					if (attribute != null && !string.IsNullOrEmpty(attribute.ToString()))
					{
						if (!flag)
						{
							writer.WriteStartElement("Configuration");
							flag = true;
						}
						writer.WriteAttributeString(text, attribute.ToString());
					}
				}
				catch
				{
				}
			}
			if (flag)
			{
				writer.WriteEndElement();
			}
			foreach (DeviceItem deviceItem in ((HardwareObject)item).DeviceItems)
			{
				TryWriteSubItemConfiguration(writer, deviceItem);
			}
		}
		catch
		{
		}
	}

	public static void TryWriteSubItemConfiguration(XmlTextWriter writer, DeviceItem subItem)
	{
		try
		{
			string[] obj = new string[13]
			{
				"Address", "StartAddress", "LogicalAddress", "InputAddress", "OutputAddress", "MeasurementType", "MeasuringRange", "InputDelay", "OutputDelay", "ChannelNumber",
				"ChannelType", "DiagnosticsEnabled", "WireBreakDetection"
			};
			bool flag = false;
			string[] array = obj;
			foreach (string text in array)
			{
				try
				{
					object attribute = ((IEngineeringObject)subItem).GetAttribute(text);
					if (attribute != null && !string.IsNullOrEmpty(attribute.ToString()))
					{
						if (!flag)
						{
							writer.WriteStartElement("ChannelInfo");
							writer.WriteAttributeString("Name", ((HardwareObject)subItem).Name);
							flag = true;
						}
						writer.WriteAttributeString(text, attribute.ToString());
					}
				}
				catch
				{
				}
			}
			if (flag)
			{
				writer.WriteEndElement();
			}
		}
		catch
		{
		}
	}

	public static void TryWriteAddressInfo(XmlTextWriter writer, object addr, string ioType)
	{
		try
		{
			writer.WriteStartElement("Address");
			writer.WriteAttributeString("IoType", ioType);
			try
			{
				IEngineeringObject val = (IEngineeringObject)((addr is IEngineeringObject) ? addr : null);
				if (val != null)
				{
					object attribute = val.GetAttribute("StartAddress");
					if (attribute != null)
					{
						writer.WriteAttributeString("StartAddress", attribute.ToString());
					}
					object attribute2 = val.GetAttribute("Length");
					if (attribute2 != null)
					{
						writer.WriteAttributeString("Length", attribute2.ToString());
					}
				}
			}
			catch
			{
			}
			writer.WriteEndElement();
		}
		catch
		{
		}
	}

	public static void TryWriteModuleAttributes(XmlTextWriter writer, DeviceItem item)
	{
		try
		{
			string[] array = new string[8] { "ModuleType", "SlotNumber", "BuiltIn", "IsPlugged", "ModuleIdentNumber", "ProfinetDeviceNumber", "GsdId", "GsdName" };
			foreach (string text in array)
			{
				try
				{
					object attribute = ((HardwareObject)item).GetAttribute(text);
					if (attribute != null && !string.IsNullOrEmpty(attribute.ToString()))
					{
						writer.WriteAttributeString(text, attribute.ToString());
					}
				}
				catch
				{
				}
			}
			TryWriteAddressAttributes(writer, item);
			foreach (DeviceItem deviceItem in ((HardwareObject)item).DeviceItems)
			{
				TryWriteAddressAttributes(writer, deviceItem);
			}
		}
		catch
		{
		}
	}

	public static void TryWriteAddressAttributes(XmlTextWriter writer, DeviceItem item)
	{
		try
		{
			object attribute = ((HardwareObject)item).GetAttribute("InputAddress");
			if (attribute == null)
			{
				attribute = ((HardwareObject)item).GetAttribute("StartInputAddress");
			}
			if (attribute != null)
			{
				writer.WriteAttributeString("InputStartAddress", attribute.ToString());
			}
			object attribute2 = ((HardwareObject)item).GetAttribute("InputLength");
			if (attribute2 == null)
			{
				attribute2 = ((HardwareObject)item).GetAttribute("InputSize");
			}
			if (attribute2 != null)
			{
				writer.WriteAttributeString("InputLength", attribute2.ToString());
			}
			object attribute3 = ((HardwareObject)item).GetAttribute("OutputAddress");
			if (attribute3 == null)
			{
				attribute3 = ((HardwareObject)item).GetAttribute("StartOutputAddress");
			}
			if (attribute3 != null)
			{
				writer.WriteAttributeString("OutputStartAddress", attribute3.ToString());
			}
			object attribute4 = ((HardwareObject)item).GetAttribute("OutputLength");
			if (attribute4 == null)
			{
				attribute4 = ((HardwareObject)item).GetAttribute("OutputSize");
			}
			if (attribute4 != null)
			{
				writer.WriteAttributeString("OutputLength", attribute4.ToString());
			}
		}
		catch
		{
		}
	}

	public static void TryWriteNetworkInfo(XmlTextWriter writer, DeviceItem item)
	{
		//IL_0019: Unknown result type (might be due to invalid IL or missing references)
		//IL_0024: Unknown result type (might be due to invalid IL or missing references)
		//IL_0026: Unknown result type (might be due to invalid IL or missing references)
		//IL_0035: Unknown result type (might be due to invalid IL or missing references)
		try
		{
			NetworkInterface service = item.GetService<NetworkInterface>();
			if (service == null)
			{
				return;
			}
			writer.WriteStartElement("NetworkInterface");
			try
			{
				InterfaceOperatingModes interfaceOperatingMode = service.InterfaceOperatingMode;
				List<string> list = new List<string>();
				if ((interfaceOperatingMode & (InterfaceOperatingModes)1) != (InterfaceOperatingModes)0)
				{
					list.Add("IoController");
				}
				if ((interfaceOperatingMode & (InterfaceOperatingModes)2) != (InterfaceOperatingModes)0)
				{
					list.Add("IoDevice");
				}
				if (list.Count > 0)
				{
					writer.WriteAttributeString("OperatingMode", string.Join(",", list));
				}
			}
			catch
			{
			}
			try
			{
				foreach (IoController ioController2 in service.IoControllers)
				{
					IoSystem ioSystem = ioController2.IoSystem;
					if (ioSystem == null)
					{
						continue;
					}
					writer.WriteStartElement("IoSystem");
					writer.WriteAttributeString("Name", ioSystem.Name);
					writer.WriteAttributeString("Number", ioSystem.Number.ToString());
					writer.WriteAttributeString("Role", "IoController");
					try
					{
						object attribute = ((IEngineeringObject)ioController2).GetAttribute("PnDeviceNumber");
						if (attribute != null)
						{
							writer.WriteAttributeString("PnDeviceNumber", attribute.ToString());
						}
					}
					catch
					{
					}
					writer.WriteEndElement();
				}
			}
			catch
			{
			}
			try
			{
				foreach (IoConnector ioConnector in service.IoConnectors)
				{
					IoSystem connectedToIoSystem = ioConnector.ConnectedToIoSystem;
					if (connectedToIoSystem == null)
					{
						continue;
					}
					writer.WriteStartElement("IoSystem");
					writer.WriteAttributeString("Name", connectedToIoSystem.Name);
					writer.WriteAttributeString("Number", connectedToIoSystem.Number.ToString());
					writer.WriteAttributeString("Role", "IoDevice");
					try
					{
						object attribute2 = ((IEngineeringObject)ioConnector).GetAttribute("PnDeviceNumber");
						if (attribute2 != null)
						{
							writer.WriteAttributeString("PnDeviceNumber", attribute2.ToString());
						}
					}
					catch
					{
					}
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
									Device val3 = DeviceItemHelper.FindParentDevice(val2);
									if (val3 != null)
									{
										writer.WriteAttributeString("IoControllerDevice", DeviceItemHelper.GetDeviceDisplayName(val3));
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
						object attribute3 = ((HardwareObject)item).GetAttribute("PnDeviceName");
						if (attribute3 != null)
						{
							writer.WriteAttributeString("PnDeviceName", attribute3.ToString());
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
							writer.WriteAttributeString("PnUpdateTime", attribute4.ToString());
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
							writer.WriteAttributeString("PnWatchdogTime", attribute5.ToString());
						}
					}
					catch
					{
					}
					writer.WriteEndElement();
				}
			}
			catch
			{
			}
			foreach (Node node in service.Nodes)
			{
				writer.WriteStartElement("Node");
				try
				{
					object attribute6 = node.GetAttribute("Address");
					if (attribute6 != null)
					{
						string value = ConvertAddressToString(attribute6);
						if (!string.IsNullOrEmpty(value))
						{
							writer.WriteAttributeString("Address", value);
						}
					}
				}
				catch
				{
				}
				try
				{
					object attribute7 = node.GetAttribute("SubnetMask");
					if (attribute7 != null)
					{
						string value2 = ConvertAddressToString(attribute7);
						if (!string.IsNullOrEmpty(value2))
						{
							writer.WriteAttributeString("SubnetMask", value2);
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
						writer.WriteAttributeString("Subnet", connectedSubnet.Name);
					}
				}
				catch
				{
				}
				writer.WriteEndElement();
			}
			writer.WriteEndElement();
		}
		catch
		{
		}
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

	public static void WriteServicesInfo(XmlTextWriter writer, DeviceItem item, List<ExportMessage> messages)
	{
		try
		{
			string deviceItemClassification = DeviceItemHelper.GetDeviceItemClassification(item);
			bool flag = deviceItemClassification == "CPU" || deviceItemClassification == "Head" || DeviceItemHelper.IsCpuModule(item);
			if (flag)
			{
				try
				{
					SoftwareContainer service = item.GetService<SoftwareContainer>();
					if (service != null)
					{
						writer.WriteStartElement("SoftwareContainer");
						WriteAllAttributesFromObject(writer, service);
						writer.WriteEndElement();
					}
				}
				catch
				{
				}
			}
			if (!flag)
			{
				try
				{
					TryWriteAllAvailableServices(writer, item, messages);
					return;
				}
				catch
				{
					return;
				}
			}
		}
		catch
		{
		}
	}

	public static void TryWriteAllAvailableServices(XmlTextWriter writer, DeviceItem item, List<ExportMessage> messages)
	{
		try
		{
			if (item == null)
			{
				return;
			}
			PropertyInfo[] properties = ((object)item).GetType().GetProperties(BindingFlags.Instance | BindingFlags.Public);
			foreach (PropertyInfo propertyInfo in properties)
			{
				try
				{
					if (propertyInfo.Name.Contains("Address") || propertyInfo.Name.Contains("Channel") || propertyInfo.Name.Contains("Port") || propertyInfo.Name.Contains("Parameter"))
					{
						object value = propertyInfo.GetValue(item);
						if (value != null)
						{
							WritePropertyValue(writer, propertyInfo.Name, value);
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

	public static void WritePropertyValue(XmlTextWriter writer, string name, object value)
	{
		//IL_002f: Unknown result type (might be due to invalid IL or missing references)
		//IL_0035: Invalid comparison between Unknown and I4
		try
		{
			IEngineeringObject val = (IEngineeringObject)((value is IEngineeringObject) ? value : null);
			if (val != null)
			{
				writer.WriteStartElement(DeviceItemHelper.SanitizeXmlName(name));
				foreach (EngineeringAttributeInfo attributeInfo in val.GetAttributeInfos())
				{
					try
					{
						if ((int)attributeInfo.AccessMode == 2)
						{
							continue;
						}
						object attribute = val.GetAttribute(attributeInfo.Name);
						if (attribute != null)
						{
							string text = attribute.ToString();
							if (!string.IsNullOrEmpty(text) && !text.StartsWith("Siemens.") && !text.StartsWith("System."))
							{
								writer.WriteAttributeString(DeviceItemHelper.SanitizeXmlName(attributeInfo.Name), text);
							}
						}
					}
					catch
					{
					}
				}
				writer.WriteEndElement();
			}
			else
			{
				if (!(value is IEnumerable enumerable) || value is string)
				{
					return;
				}
				List<object> list = new List<object>();
				foreach (object item in enumerable)
				{
					list.Add(item);
				}
				writer.WriteStartElement(DeviceItemHelper.SanitizeXmlName(name));
				writer.WriteAttributeString("Count", list.Count.ToString());
				foreach (object item2 in list)
				{
					WritePropertyValue(writer, "Item", item2);
				}
				writer.WriteEndElement();
			}
		}
		catch
		{
		}
	}

	public static void WriteAddressControllerFullInfo(XmlTextWriter writer, AddressController addressController, List<ExportMessage> messages)
	{
		//IL_01e5: Unknown result type (might be due to invalid IL or missing references)
		//IL_01eb: Invalid comparison between Unknown and I4
		//IL_0386: Unknown result type (might be due to invalid IL or missing references)
		//IL_038c: Invalid comparison between Unknown and I4
		try
		{
			HashSet<string> addressAttrNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
			{
				"StartAddress", "EndAddress", "Length", "Address", "InputAddress", "OutputAddress", "LogicalAddress", "InputStartAddress", "InputEndAddress", "InputLength",
				"OutputStartAddress", "OutputEndAddress", "OutputLength", "IoAddress", "HwAddress", "AddressIn", "AddressOut", "StartInputAddress", "StartOutputAddress", "RegisteredAddresses",
				"OwnedBy"
			};
			IList<EngineeringAttributeInfo> attributeInfos = ((IEngineeringObject)addressController).GetAttributeInfos();
			bool flag = attributeInfos.Any((EngineeringAttributeInfo a) => addressAttrNames.Contains(a.Name));
			PropertyInfo[] properties = ((object)addressController).GetType().GetProperties(BindingFlags.Instance | BindingFlags.Public);
			bool flag2 = false;
			PropertyInfo[] array = properties;
			foreach (PropertyInfo propertyInfo in array)
			{
				if (!typeof(IEnumerable).IsAssignableFrom(propertyInfo.PropertyType) || !(propertyInfo.PropertyType != typeof(string)))
				{
					continue;
				}
				try
				{
					if (propertyInfo.GetValue(addressController) is IEnumerable source && source.Cast<object>().Any())
					{
						flag2 = true;
						break;
					}
				}
				catch
				{
				}
			}
			if (!flag && !flag2)
			{
				return;
			}
			writer.WriteStartElement("AddressController");
			foreach (EngineeringAttributeInfo item in attributeInfos)
			{
				try
				{
					if ((int)item.AccessMode == 2 || !addressAttrNames.Contains(item.Name))
					{
						continue;
					}
					object attribute = ((IEngineeringObject)addressController).GetAttribute(item.Name);
					if (attribute != null)
					{
						string text = attribute.ToString();
						if (!string.IsNullOrEmpty(text) && !text.StartsWith("Siemens."))
						{
							writer.WriteAttributeString(DeviceItemHelper.SanitizeXmlName(item.Name), text);
						}
					}
				}
				catch
				{
				}
			}
			try
			{
				array = properties;
				foreach (PropertyInfo propertyInfo2 in array)
				{
					try
					{
						if (!typeof(IEnumerable).IsAssignableFrom(propertyInfo2.PropertyType) || !(propertyInfo2.PropertyType != typeof(string)) || !(propertyInfo2.GetValue(addressController) is IEnumerable enumerable))
						{
							continue;
						}
						List<object> list = new List<object>();
						foreach (object item2 in enumerable)
						{
							list.Add(item2);
						}
						writer.WriteStartElement(DeviceItemHelper.SanitizeXmlName(propertyInfo2.Name));
						writer.WriteAttributeString("Count", list.Count.ToString());
						foreach (object item3 in list)
						{
							try
							{
								writer.WriteStartElement("Item");
								IEngineeringObject val = (IEngineeringObject)((item3 is IEngineeringObject) ? item3 : null);
								if (val != null)
								{
									foreach (EngineeringAttributeInfo attributeInfo in val.GetAttributeInfos())
									{
										try
										{
											if ((int)attributeInfo.AccessMode == 2)
											{
												continue;
											}
											object attribute2 = val.GetAttribute(attributeInfo.Name);
											if (attribute2 != null)
											{
												string text2 = attribute2.ToString();
												if (!string.IsNullOrEmpty(text2) && !text2.StartsWith("Siemens."))
												{
													writer.WriteAttributeString(DeviceItemHelper.SanitizeXmlName(attributeInfo.Name), text2);
												}
											}
										}
										catch
										{
										}
									}
								}
								else
								{
									WriteObjectPropertiesAsAttributes(writer, item3);
								}
								writer.WriteEndElement();
							}
							catch
							{
							}
						}
						writer.WriteEndElement();
					}
					catch
					{
					}
				}
			}
			catch (Exception ex)
			{
				messages.Add(ExportMessage.Warning("AddressController", "Collections", "Could not enumerate collections: " + ex.Message));
			}
			writer.WriteEndElement();
		}
		catch
		{
		}
	}
}
