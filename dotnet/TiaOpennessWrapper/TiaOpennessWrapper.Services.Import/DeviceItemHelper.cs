using System;
using System.IO;
using System.Linq;
using System.Text;
using Siemens.Engineering;
using Siemens.Engineering.HW;
using Siemens.Engineering.HW.Features;
using Siemens.Engineering.Hmi;
using Siemens.Engineering.HmiUnified;
using Siemens.Engineering.SW;

namespace TiaOpennessWrapper.Services.Import;

internal static class DeviceItemHelper
{
	public static string GetDeviceDisplayName(Device device)
	{
		try
		{
			string text = FindUserDefinedDeviceName(((HardwareObject)device).DeviceItems);
			if (!string.IsNullOrEmpty(text))
			{
				return text;
			}
			return ((HardwareObject)device).Name ?? "Unknown";
		}
		catch
		{
			return ((HardwareObject)device).Name ?? "Unknown";
		}
	}

	public static string? FindUserDefinedDeviceName(DeviceItemComposition items)
	{
		foreach (DeviceItem item in items)
		{
			switch (GetDeviceItemClassification(item))
			{
			case "CPU":
			case "Head":
			case "InterfaceModule":
			case "HM":
				if (!string.IsNullOrEmpty(((HardwareObject)item).Name))
				{
					return ((HardwareObject)item).Name;
				}
				break;
			}
			if (((HardwareObject)item).DeviceItems.Count > 0)
			{
				string text = FindUserDefinedDeviceName(((HardwareObject)item).DeviceItems);
				if (!string.IsNullOrEmpty(text))
				{
					return text;
				}
			}
		}
		return null;
	}

	public static string GetDeviceTypeIdentifier(Device device)
	{
		try
		{
			return ((HardwareObject)device).TypeIdentifier ?? "";
		}
		catch
		{
			return "";
		}
	}

	public static string GetDeviceType(Device device)
	{
		try
		{
			if (HasPlcSoftware(((HardwareObject)device).DeviceItems))
			{
				return "PLC";
			}
			if (HasHmiSoftware(((HardwareObject)device).DeviceItems))
			{
				return "HMI";
			}
		}
		catch
		{
		}
		return "Device";
	}

	private static bool HasPlcSoftware(DeviceItemComposition items)
	{
		foreach (DeviceItem item in items)
		{
			try
			{
				SoftwareContainer service = item.GetService<SoftwareContainer>();
				if (((service != null) ? service.Software : null) is PlcSoftware)
				{
					return true;
				}
			}
			catch
			{
			}
			if (((HardwareObject)item).DeviceItems.Count > 0 && HasPlcSoftware(((HardwareObject)item).DeviceItems))
			{
				return true;
			}
		}
		return false;
	}

	private static bool HasHmiSoftware(DeviceItemComposition items)
	{
		foreach (DeviceItem item in items)
		{
			try
			{
				SoftwareContainer service = item.GetService<SoftwareContainer>();
				if (((service != null) ? service.Software : null) != null)
				{
					if (service.Software is HmiTarget)
					{
						return true;
					}
					if (service.Software is HmiSoftware)
					{
						return true;
					}
				}
			}
			catch
			{
			}
			if (((HardwareObject)item).DeviceItems.Count > 0 && HasHmiSoftware(((HardwareObject)item).DeviceItems))
			{
				return true;
			}
		}
		return false;
	}

	public static string GetDeviceItemClassification(DeviceItem item)
	{
		try
		{
			return ((HardwareObject)item).GetAttribute("Classification")?.ToString() ?? "";
		}
		catch
		{
			return "";
		}
	}

	public static string GetTypeIdentifier(DeviceItem item)
	{
		try
		{
			return ((HardwareObject)item).GetAttribute("TypeIdentifier")?.ToString() ?? ((HardwareObject)item).Name;
		}
		catch
		{
			return ((HardwareObject)item).Name;
		}
	}

	public static bool IsModule(DeviceItem item)
	{
		string deviceItemClassification = GetDeviceItemClassification(item);
		switch (deviceItemClassification)
		{
		default:
			return deviceItemClassification == "HM";
		case "Module":
		case "Head":
		case "CPU":
		case "InterfaceModule":
		case "IOModule":
			return true;
		}
	}

	public static bool IsCpuModule(DeviceItem item)
	{
		string deviceItemClassification = GetDeviceItemClassification(item);
		string typeIdentifier = GetTypeIdentifier(item);
		if (!(deviceItemClassification == "CPU") && !(deviceItemClassification == "Head") && !typeIdentifier.Contains("CPU") && !typeIdentifier.Contains("1500"))
		{
			return typeIdentifier.Contains("1200");
		}
		return true;
	}

	public static bool IsIoModule(DeviceItem item)
	{
		string deviceItemClassification = GetDeviceItemClassification(item);
		string typeIdentifier = GetTypeIdentifier(item);
		if (!(deviceItemClassification == "IOModule") && !typeIdentifier.Contains("DI") && !typeIdentifier.Contains("DO") && !typeIdentifier.Contains("AI"))
		{
			return typeIdentifier.Contains("AO");
		}
		return true;
	}

	public static bool IsChannel(DeviceItem item)
	{
		if (!(GetDeviceItemClassification(item) == "Channel"))
		{
			return ((HardwareObject)item).Name.StartsWith("Ch");
		}
		return true;
	}

	public static string GetModuleType(DeviceItem item)
	{
		if (IsCpuModule(item))
		{
			return "CPU";
		}
		if (IsIoModule(item))
		{
			string typeIdentifier = GetTypeIdentifier(item);
			if (typeIdentifier.Contains("DI"))
			{
				return "DigitalInput";
			}
			if (typeIdentifier.Contains("DO"))
			{
				return "DigitalOutput";
			}
			if (typeIdentifier.Contains("AI"))
			{
				return "AnalogInput";
			}
			if (typeIdentifier.Contains("AO"))
			{
				return "AnalogOutput";
			}
			return "IOModule";
		}
		if (GetDeviceItemClassification(item) == "InterfaceModule")
		{
			return "InterfaceModule";
		}
		return "Module";
	}

	public static int GetPositionNumber(DeviceItem item)
	{
		try
		{
			object attribute = ((HardwareObject)item).GetAttribute("PositionNumber");
			return (attribute != null) ? Convert.ToInt32(attribute) : 0;
		}
		catch
		{
			return 0;
		}
	}

	public static int GetChannelNumber(DeviceItem item)
	{
		try
		{
			string name = ((HardwareObject)item).Name;
			if (name.StartsWith("Ch") && int.TryParse(new string(name.Skip(2).TakeWhile(char.IsDigit).ToArray()), out var result))
			{
				return result;
			}
			object attribute = ((HardwareObject)item).GetAttribute("ChannelNumber");
			return (attribute != null) ? Convert.ToInt32(attribute) : 0;
		}
		catch
		{
			return 0;
		}
	}

	public static string GetChannelType(DeviceItem item)
	{
		try
		{
			return ((HardwareObject)item).GetAttribute("ChannelType")?.ToString() ?? "Unknown";
		}
		catch
		{
			return "Unknown";
		}
	}

	public static string GetChannelIoType(DeviceItem item)
	{
		string typeIdentifier = GetTypeIdentifier(item);
		if (typeIdentifier.Contains("DI") || typeIdentifier.Contains("Input"))
		{
			return "Input";
		}
		if (typeIdentifier.Contains("DO") || typeIdentifier.Contains("Output"))
		{
			return "Output";
		}
		if (typeIdentifier.Contains("AI"))
		{
			return "AnalogInput";
		}
		if (typeIdentifier.Contains("AO"))
		{
			return "AnalogOutput";
		}
		return "Unknown";
	}

	public static string GetInterfaceType(NetworkInterface networkInterface)
	{
		//IL_0001: Unknown result type (might be due to invalid IL or missing references)
		//IL_0006: Unknown result type (might be due to invalid IL or missing references)
		try
		{
			return ((object)networkInterface.InterfaceType/*cast due to constrained. prefix*/).ToString();
		}
		catch
		{
			return "Unknown";
		}
	}

	public static string GetSubnetType(Subnet subnet)
	{
		try
		{
			string text = subnet.GetAttribute("TypeIdentifier")?.ToString() ?? "";
			if (text.Contains("Profinet"))
			{
				return "PROFINET";
			}
			if (text.Contains("Profibus"))
			{
				return "PROFIBUS";
			}
			if (text.Contains("IE") || text.Contains("Ethernet"))
			{
				return "Industrial Ethernet";
			}
			if (text.Contains("MPI"))
			{
				return "MPI";
			}
			return text;
		}
		catch
		{
			return "Unknown";
		}
	}

	public static string GetNodeDeviceName(Node node)
	{
		try
		{
			object attribute = node.GetAttribute("ParentDeviceItem");
			DeviceItem val = (DeviceItem)((attribute is DeviceItem) ? attribute : null);
			if (val != null)
			{
				Device? deviceFromItem = GetDeviceFromItem(val);
				return ((deviceFromItem != null) ? ((HardwareObject)deviceFromItem).Name : null) ?? "";
			}
			return "";
		}
		catch
		{
			return "";
		}
	}

	public static Device? GetDeviceFromItem(DeviceItem item)
	{
		try
		{
			DeviceItem val = item;
			while (val != null)
			{
				IEngineeringObject parent = ((HardwareObject)val).Parent;
				Device val2 = (Device)(object)((parent is Device) ? parent : null);
				if (val2 != null)
				{
					return val2;
				}
				IEngineeringObject parent2 = ((HardwareObject)val).Parent;
				DeviceItem val3 = (DeviceItem)(object)((parent2 is DeviceItem) ? parent2 : null);
				if (val3 == null)
				{
					break;
				}
				val = val3;
			}
			return null;
		}
		catch
		{
			return null;
		}
	}

	public static Device? FindParentDevice(DeviceItem item)
	{
		try
		{
			for (IEngineeringObject val = (IEngineeringObject)(object)item; val != null; val = ((IEngineeringInstance)val).Parent)
			{
				Device val2 = (Device)(object)((val is Device) ? val : null);
				if (val2 != null)
				{
					return val2;
				}
			}
			return null;
		}
		catch
		{
			return null;
		}
	}

	public static string SanitizeFileName(string name)
	{
		char[] invalidFileNameChars = Path.GetInvalidFileNameChars();
		foreach (char oldChar in invalidFileNameChars)
		{
			name = name.Replace(oldChar, '_');
		}
		return name;
	}

	public static string SanitizeXmlName(string name)
	{
		if (string.IsNullOrEmpty(name))
		{
			return "Attr";
		}
		if (char.IsDigit(name[0]))
		{
			name = "_" + name;
		}
		StringBuilder stringBuilder = new StringBuilder();
		string text = name;
		foreach (char c in text)
		{
			if (char.IsLetterOrDigit(c) || c == '_' || c == '-' || c == '.')
			{
				stringBuilder.Append(c);
			}
			else
			{
				stringBuilder.Append('_');
			}
		}
		return stringBuilder.ToString();
	}
}
