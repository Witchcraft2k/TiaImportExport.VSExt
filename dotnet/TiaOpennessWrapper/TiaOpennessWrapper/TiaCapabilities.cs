using System;

namespace TiaOpennessWrapper;

internal static class TiaCapabilities
{
	public static int Version => TiaConnector.GetInitializedVersionNumber();

	public static bool SupportsSdFormat => false;

	public static void Require(int minVersion, string feature)
	{
		if (Version > 0 && Version < minVersion)
		{
			throw new NotSupportedException($"{feature} requires TIA Portal V{minVersion} or newer (current: V{Version}).");
		}
	}
}
