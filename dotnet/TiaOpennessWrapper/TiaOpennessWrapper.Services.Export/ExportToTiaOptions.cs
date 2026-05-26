namespace TiaOpennessWrapper.Services.Export;

public class ExportToTiaOptions
{
	public bool OverwriteExisting { get; set; } = true;

	public bool Recursive { get; set; } = true;

	public string? BasePath { get; set; }

	public bool PreserveFolderStructure { get; set; } = true;

	public bool ImportNetworkConfig { get; set; } = true;

	public bool CompareBeforeImport { get; set; }

	public bool DeleteOrphanedGroups { get; set; } = true;

	public string? SourceXlsxPath { get; set; }
}
