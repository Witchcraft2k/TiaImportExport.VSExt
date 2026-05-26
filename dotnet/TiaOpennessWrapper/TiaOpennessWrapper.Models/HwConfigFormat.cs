namespace TiaOpennessWrapper.Models;

public static class HwConfigFormat
{
	public const string Xml = "xml";

	public const string Cax = "cax";

	public static string Normalize(string? value)
	{
		if (string.IsNullOrWhiteSpace(value))
		{
			return "xml";
		}
		switch (value.Trim().ToLowerInvariant())
		{
		case "cax":
		case "aml":
		case "automationml":
			return "cax";
		default:
			return "xml";
		}
	}
}
