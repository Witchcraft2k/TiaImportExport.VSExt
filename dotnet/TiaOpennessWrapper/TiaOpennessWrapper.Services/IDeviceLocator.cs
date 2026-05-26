using Siemens.Engineering.HW;
using Siemens.Engineering.SW;

namespace TiaOpennessWrapper.Services;

public interface IDeviceLocator
{
	Device? FindDevice(string deviceId);

	PlcSoftware? GetPlcSoftware(Device device);
}
