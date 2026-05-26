namespace TiaOpennessWrapper.Services.Export;

public class HwConfigExportToTiaOptions
{
	public bool OverwriteExisting { get; set; }

	public bool ImportNetworkConfig { get; set; } = true;

	public bool UpdateExisting { get; set; } = true;

	public string ImportMode { get; set; } = "Update";

	public bool SkipIfIdentical { get; set; } = true;

	public bool ShowComparisonDetails { get; set; } = true;

	public string Format { get; set; } = "xml";
}
