using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Xml.Linq;
using Siemens.Engineering;
using Siemens.Engineering.Cax;
using Siemens.Engineering.HW;
using TiaOpennessWrapper.Models;

namespace TiaOpennessWrapper.Services.Export;

public static class HwConfigComparisonService
{
	private class HwConfigData
	{
		public string DeviceName { get; set; } = "";

		public string TypeIdentifier { get; set; } = "";

		public Dictionary<string, ModuleData> Modules { get; set; } = new Dictionary<string, ModuleData>();

		public Dictionary<string, AddressData> Addresses { get; set; } = new Dictionary<string, AddressData>();
	}

	private class ModuleData
	{
		public string Name { get; set; } = "";

		public string OrderNumber { get; set; } = "";

		public int PositionNumber { get; set; }

		public string TypeName { get; set; } = "";

		public int StartAddressInput { get; set; } = -1;

		public int StartAddressOutput { get; set; } = -1;
	}

	private class AddressData
	{
		public string IoType { get; set; } = "";

		public int StartAddress { get; set; }

		public int Length { get; set; }
	}

	public static HwConfigComparisonDetails CompareDeviceWithXml(ProjectBase project, Device device, string xmlFilePath, List<ExportMessage> messages)
	{
		HwConfigComparisonDetails hwConfigComparisonDetails = new HwConfigComparisonDetails();
		string text = null;
		try
		{
			text = ExportDeviceToTempXml(project, device, messages);
			if (string.IsNullOrEmpty(text))
			{
				hwConfigComparisonDetails.Result = HwConfigComparisonResult.ComparisonFailed;
				hwConfigComparisonDetails.ErrorMessage = "Could not export device for comparison";
				messages.Add(ExportMessage.Warning(((HardwareObject)device).Name, "Compare", "Could not export device for comparison"));
				return hwConfigComparisonDetails;
			}
			HwConfigData hwConfigData = ParseHwConfigXml(text);
			HwConfigData hwConfigData2 = ParseHwConfigXml(xmlFilePath);
			if (hwConfigData == null || hwConfigData2 == null)
			{
				hwConfigComparisonDetails.Result = HwConfigComparisonResult.ComparisonFailed;
				hwConfigComparisonDetails.ErrorMessage = "Could not parse XML files for comparison";
				messages.Add(ExportMessage.Warning(((HardwareObject)device).Name, "Compare", "Could not parse XML for comparison"));
				return hwConfigComparisonDetails;
			}
			CompareDeviceItems(hwConfigData, hwConfigData2, hwConfigComparisonDetails, messages);
			CompareAddresses(hwConfigData, hwConfigData2, hwConfigComparisonDetails, messages);
			CompareParameters(hwConfigData, hwConfigData2, hwConfigComparisonDetails, messages);
			if (hwConfigComparisonDetails.HasDifferences)
			{
				hwConfigComparisonDetails.Result = HwConfigComparisonResult.Different;
				messages.Add(ExportMessage.Info(((HardwareObject)device).Name, "Compare", $"Found differences: {hwConfigComparisonDetails.AddedModules.Count} added, {hwConfigComparisonDetails.RemovedModules.Count} removed, " + $"{hwConfigComparisonDetails.ChangedModules.Count} changed modules, {hwConfigComparisonDetails.ChangedAddresses.Count} address changes"));
			}
			else
			{
				hwConfigComparisonDetails.Result = HwConfigComparisonResult.Same;
				messages.Add(ExportMessage.Info(((HardwareObject)device).Name, "Compare", "Device configuration is identical - skipping update"));
			}
			return hwConfigComparisonDetails;
		}
		catch (Exception ex)
		{
			hwConfigComparisonDetails.Result = HwConfigComparisonResult.ComparisonFailed;
			hwConfigComparisonDetails.ErrorMessage = ex.Message;
			messages.Add(ExportMessage.Warning(((HardwareObject)device).Name, "Compare", "Comparison failed: " + ex.Message));
			return hwConfigComparisonDetails;
		}
		finally
		{
			CleanupTempFiles(text);
		}
	}

	private static string? ExportDeviceToTempXml(ProjectBase project, Device device, List<ExportMessage> messages)
	{
		try
		{
			string text = Path.Combine(Path.GetTempPath(), "TiaHwCompare_" + Guid.NewGuid().ToString("N"));
			Directory.CreateDirectory(text);
			string text2 = SanitizeFileName(((HardwareObject)device).Name ?? "Device");
			string text3 = Path.Combine(text, text2 + "_HwConfig.aml");
			string fileName = Path.Combine(text, "export.log");
			string text4 = Path.Combine(text, text2 + "_HwConfig.xml");
			try
			{
				CaxProvider service = project.GetService<CaxProvider>();
				if (service != null)
				{
					service.Export(device, new FileInfo(text3), new FileInfo(fileName));
					if (File.Exists(text3))
					{
						messages.Add(ExportMessage.Info(((HardwareObject)device).Name ?? "Device", "Compare", "Exported device via CAx for comparison"));
						return text3;
					}
				}
			}
			catch (Exception ex)
			{
				messages.Add(ExportMessage.Info(((HardwareObject)device).Name ?? "Device", "Compare", "CAx export not available: " + ex.Message));
			}
			CreateComparisonXmlFromDevice(device).Save(text4);
			messages.Add(ExportMessage.Info(((HardwareObject)device).Name ?? "Device", "Compare", "Created comparison XML from device structure"));
			return text4;
		}
		catch (Exception ex2)
		{
			messages.Add(ExportMessage.Warning(((HardwareObject)device).Name ?? "Device", "Compare", "Failed to export for comparison: " + ex2.Message));
			return null;
		}
	}

	private static string SanitizeFileName(string name)
	{
		if (string.IsNullOrEmpty(name))
		{
			return "Device";
		}
		char[] invalidFileNameChars = Path.GetInvalidFileNameChars();
		foreach (char oldChar in invalidFileNameChars)
		{
			name = name.Replace(oldChar, '_');
		}
		name = name.Replace(' ', '_');
		return name;
	}

	private static XDocument CreateComparisonXmlFromDevice(Device device)
	{
		return new XDocument(new XElement("HwConfig", new XElement("Device", new XAttribute("Name", ((HardwareObject)device).Name ?? ""), new XAttribute("TypeIdentifier", ((HardwareObject)device).TypeIdentifier ?? ""), CreateDeviceItemsElement(((HardwareObject)device).DeviceItems))));
	}

	private static XElement CreateDeviceItemsElement(DeviceItemComposition items)
	{
		XElement xElement = new XElement("DeviceItems");
		foreach (DeviceItem item in items)
		{
			XElement xElement2 = new XElement("DeviceItem", new XAttribute("Name", ((HardwareObject)item).Name ?? ""));
			try
			{
				object attribute = ((HardwareObject)item).GetAttribute("OrderNumber");
				if (attribute != null)
				{
					xElement2.Add(new XAttribute("OrderNumber", attribute));
				}
			}
			catch
			{
			}
			try
			{
				object attribute2 = ((HardwareObject)item).GetAttribute("PositionNumber");
				if (attribute2 != null)
				{
					xElement2.Add(new XAttribute("PositionNumber", attribute2));
				}
			}
			catch
			{
			}
			try
			{
				object attribute3 = ((HardwareObject)item).GetAttribute("TypeName");
				if (attribute3 != null)
				{
					xElement2.Add(new XAttribute("TypeName", attribute3));
				}
			}
			catch
			{
			}
			XElement xElement3 = CreateAddressesElement(item);
			if (xElement3.HasElements)
			{
				xElement2.Add(xElement3);
			}
			if (((HardwareObject)item).DeviceItems.Count > 0)
			{
				xElement2.Add(CreateDeviceItemsElement(((HardwareObject)item).DeviceItems));
			}
			xElement.Add(xElement2);
		}
		return xElement;
	}

	private static XElement CreateAddressesElement(DeviceItem item)
	{
		XElement xElement = new XElement("Addresses");
		try
		{
			try
			{
				((HardwareObject)item).GetAttribute("IoAddresses");
			}
			catch
			{
			}
			try
			{
				object attribute = ((HardwareObject)item).GetAttribute("StartAddress");
				object attribute2 = ((HardwareObject)item).GetAttribute("Length");
				object attribute3 = ((HardwareObject)item).GetAttribute("IoType");
				if (attribute != null)
				{
					XElement content = new XElement("Address", new XAttribute("StartAddress", attribute), new XAttribute("Length", attribute2 ?? ((object)0)), new XAttribute("IoType", attribute3 ?? "Unknown"));
					xElement.Add(content);
				}
			}
			catch
			{
			}
		}
		catch
		{
		}
		return xElement;
	}

	private static HwConfigData? ParseHwConfigXml(string xmlFilePath)
	{
		try
		{
			XDocument xDocument = XDocument.Load(xmlFilePath);
			HwConfigData hwConfigData = new HwConfigData();
			XElement xElement = xDocument.Descendants().FirstOrDefault((XElement e) => e.Name.LocalName == "Device" || e.Name.LocalName == "InternalElement");
			if (xElement == null)
			{
				return null;
			}
			hwConfigData.DeviceName = xElement.Attribute("Name")?.Value ?? "";
			hwConfigData.TypeIdentifier = xElement.Attribute("TypeIdentifier")?.Value ?? "";
			ParseDeviceItems(xElement, hwConfigData.Modules);
			ParseAddresses(xElement, hwConfigData.Addresses);
			return hwConfigData;
		}
		catch
		{
			return null;
		}
	}

	private static void ParseDeviceItems(XElement element, Dictionary<string, ModuleData> modules)
	{
		foreach (XElement item in from e in element.Descendants()
			where e.Name.LocalName == "DeviceItem" || e.Name.LocalName == "InternalElement"
			select e)
		{
			string text = item.Attribute("Name")?.Value;
			string text2 = item.Attribute("OrderNumber")?.Value;
			string s = item.Attribute("PositionNumber")?.Value;
			string text3 = item.Attribute("TypeName")?.Value;
			if (string.IsNullOrEmpty(text2))
			{
				continue;
			}
			int result;
			int num = (int.TryParse(s, out result) ? result : 0);
			string key = $"{text2}@{num}";
			int num2 = -1;
			int num3 = -1;
			foreach (XElement item2 in from e in item.Descendants()
				where e.Name.LocalName == "Address"
				select e)
			{
				string text4 = item2.Attribute("IoType")?.Value ?? item2.Attribute("Type")?.Value;
				if (int.TryParse(item2.Attribute("StartAddress")?.Value, out var result2))
				{
					if (text4 == "Input" && num2 < 0)
					{
						num2 = result2;
					}
					if (text4 == "Output" && num3 < 0)
					{
						num3 = result2;
					}
				}
			}
			if (!modules.ContainsKey(key))
			{
				modules[key] = new ModuleData
				{
					Name = (text ?? ""),
					OrderNumber = (text2 ?? ""),
					PositionNumber = num,
					TypeName = (text3 ?? ""),
					StartAddressInput = num2,
					StartAddressOutput = num3
				};
			}
		}
	}

	private static void ParseAddresses(XElement element, Dictionary<string, AddressData> addresses)
	{
		foreach (XElement item in from e in element.Descendants()
			where e.Name.LocalName == "Address"
			select e)
		{
			string text = item.Attribute("IoType")?.Value ?? item.Attribute("Type")?.Value;
			string text2 = item.Attribute("StartAddress")?.Value;
			string s = item.Attribute("Length")?.Value;
			if (!string.IsNullOrEmpty(text2))
			{
				string key = text + "_" + text2;
				addresses[key] = new AddressData
				{
					IoType = (text ?? ""),
					StartAddress = (int.TryParse(text2, out var result) ? result : 0),
					Length = (int.TryParse(s, out var result2) ? result2 : 0)
				};
			}
		}
	}

	private static void CompareDeviceItems(HwConfigData existing, HwConfigData newConfig, HwConfigComparisonDetails result, List<ExportMessage> messages)
	{
		foreach (KeyValuePair<string, ModuleData> module in newConfig.Modules)
		{
			if (!existing.Modules.ContainsKey(module.Key))
			{
				result.AddedModules.Add($"{module.Value.Name} ({module.Value.OrderNumber} @ pos {module.Value.PositionNumber})");
				result.Differences.Add($"Added module: {module.Value.OrderNumber} at position {module.Value.PositionNumber}");
				messages.Add(ExportMessage.Info(module.Value.Name, "Compare", $"New module: {module.Value.OrderNumber} at position {module.Value.PositionNumber}"));
				continue;
			}
			ModuleData moduleData = existing.Modules[module.Key];
			List<string> list = new List<string>();
			if (moduleData.Name != module.Value.Name)
			{
				list.Add("Name: " + moduleData.Name + " -> " + module.Value.Name);
			}
			if (moduleData.StartAddressInput != module.Value.StartAddressInput && moduleData.StartAddressInput >= 0 && module.Value.StartAddressInput >= 0)
			{
				list.Add($"Input: {moduleData.StartAddressInput} -> {module.Value.StartAddressInput}");
			}
			if (moduleData.StartAddressOutput != module.Value.StartAddressOutput && moduleData.StartAddressOutput >= 0 && module.Value.StartAddressOutput >= 0)
			{
				list.Add($"Output: {moduleData.StartAddressOutput} -> {module.Value.StartAddressOutput}");
			}
			if (list.Count > 0)
			{
				string text = string.Join(", ", list);
				result.ChangedModules.Add($"{module.Value.Name} ({module.Value.OrderNumber} @ pos {module.Value.PositionNumber}): {text}");
				result.Differences.Add("Module changed: " + module.Value.OrderNumber + " - " + text);
				messages.Add(ExportMessage.Info(module.Value.Name, "Compare", "Module changed: " + text));
			}
		}
		foreach (KeyValuePair<string, ModuleData> module2 in existing.Modules)
		{
			if (!newConfig.Modules.ContainsKey(module2.Key))
			{
				result.RemovedModules.Add($"{module2.Value.Name} ({module2.Value.OrderNumber} @ pos {module2.Value.PositionNumber})");
				result.Differences.Add($"Removed module: {module2.Value.OrderNumber} at position {module2.Value.PositionNumber}");
				messages.Add(ExportMessage.Warning(module2.Value.Name, "Compare", $"Module in TIA not in XML: {module2.Value.OrderNumber} at position {module2.Value.PositionNumber}"));
			}
		}
	}

	private static void CompareAddresses(HwConfigData existing, HwConfigData newConfig, HwConfigComparisonDetails result, List<ExportMessage> messages)
	{
		foreach (KeyValuePair<string, AddressData> address in newConfig.Addresses)
		{
			if (!existing.Addresses.ContainsKey(address.Key))
			{
				result.AddedAddresses.Add($"{address.Value.IoType}: {address.Value.StartAddress} (length: {address.Value.Length})");
				result.Differences.Add("Added address: " + address.Key);
				messages.Add(ExportMessage.Info("Address", "Compare", $"New address: {address.Value.IoType} at {address.Value.StartAddress}"));
				continue;
			}
			AddressData addressData = existing.Addresses[address.Key];
			if (addressData.Length != address.Value.Length)
			{
				result.ChangedAddresses.Add($"{address.Value.IoType} at {address.Value.StartAddress}: length {addressData.Length} -> {address.Value.Length}");
				result.Differences.Add("Changed address length: " + address.Key);
				messages.Add(ExportMessage.Info("Address", "Compare", $"Address length changed: {address.Value.IoType} at {address.Value.StartAddress}"));
			}
		}
	}

	private static void CompareParameters(HwConfigData existing, HwConfigData newConfig, HwConfigComparisonDetails result, List<ExportMessage> messages)
	{
	}

	private static void CleanupTempFiles(string? tempFilePath)
	{
		try
		{
			if (!string.IsNullOrEmpty(tempFilePath))
			{
				string directoryName = Path.GetDirectoryName(tempFilePath);
				if (File.Exists(tempFilePath))
				{
					File.Delete(tempFilePath);
				}
				if (!string.IsNullOrEmpty(directoryName) && Directory.Exists(directoryName))
				{
					Directory.Delete(directoryName, recursive: true);
				}
			}
		}
		catch
		{
		}
	}
}
