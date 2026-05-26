using System.Collections.Generic;
using Siemens.Engineering;
using Siemens.Engineering.HW;
using Siemens.Engineering.SW;
using TiaOpennessWrapper.Models;

namespace TiaOpennessWrapper.Services;

internal static class PlcContextResolver
{
	internal static (PlcSoftware? plc, Device? device, object? error) ResolvePlc(IDeviceLocator devices, ProjectBase? project, string deviceId)
	{
		if (project == null)
		{
			return (plc: null, device: null, error: MakeError("No project selected"));
		}
		Device val = devices.FindDevice(deviceId);
		if (val == null)
		{
			return (plc: null, device: null, error: MakeError("Device not found"));
		}
		PlcSoftware plcSoftware = devices.GetPlcSoftware(val);
		if (plcSoftware == null)
		{
			return (plc: null, device: val, error: MakeError("PLC software not found"));
		}
		return (plc: plcSoftware, device: val, error: null);
	}

	internal static (Device? device, object? error) ResolveDevice(IDeviceLocator devices, ProjectBase? project, string deviceId)
	{
		if (project == null)
		{
			return (device: null, error: MakeError("No project selected"));
		}
		Device val = devices.FindDevice(deviceId);
		if (val == null)
		{
			return (device: null, error: MakeError("Device not found"));
		}
		return (device: val, error: null);
	}

	private static object MakeError(string message)
	{
		return new
		{
			success = false,
			error = message,
			messages = new List<ExportMessage>()
		};
	}
}
