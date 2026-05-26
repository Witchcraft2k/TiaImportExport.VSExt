namespace TiaOpennessWrapper.Interop;

internal static class TiaConnectionGuard
{
	internal static bool TryGetService(TiaPortalService? service, out TiaPortalService connectedService, out object errorResult)
	{
		if (service == null)
		{
			connectedService = null;
			errorResult = NotConnectedResult();
			return false;
		}
		connectedService = service;
		errorResult = null;
		return true;
	}

	internal static object NotConnectedResult()
	{
		return new
		{
			success = false,
			error = "Not connected to TIA Portal"
		};
	}
}
