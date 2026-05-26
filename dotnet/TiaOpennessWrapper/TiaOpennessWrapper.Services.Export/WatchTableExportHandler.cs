using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Siemens.Engineering;
using Siemens.Engineering.SW;
using Siemens.Engineering.SW.WatchAndForceTables;
using TiaOpennessWrapper.Models;

namespace TiaOpennessWrapper.Services.Export;

public class WatchTableExportHandler
{
	public object ExportWatchTable(PlcSoftware plcSoftware, string xmlFilePath, ExportToTiaOptions options, List<ExportMessage> messages)
	{
		//IL_00e2: Expected O, but got Unknown
		//IL_01bd: Expected O, but got Unknown
		//IL_025a: Expected O, but got Unknown
		//IL_0215: Unknown result type (might be due to invalid IL or missing references)
		//IL_021e: Unknown result type (might be due to invalid IL or missing references)
		string fileName = Path.GetFileName(xmlFilePath);
		try
		{
			FileInfo fileInfo = new FileInfo(xmlFilePath);
			PlcWatchAndForceTableSystemGroup watchAndForceTableGroup = plcSoftware.WatchAndForceTableGroup;
			string tableName = XmlComparisonService.ExtractNameFromXml(xmlFilePath) ?? Path.GetFileNameWithoutExtension(xmlFilePath);
			PlcWatchTable val = ((IEnumerable<PlcWatchTable>)((PlcWatchAndForceTableGroup)watchAndForceTableGroup).WatchTables).FirstOrDefault((PlcWatchTable t) => string.Equals(t.Name, tableName, StringComparison.OrdinalIgnoreCase));
			if (options.CompareBeforeImport && val != null)
			{
				switch (XmlComparisonService.CompareWatchTableWithXml(val, xmlFilePath))
				{
				case BlockComparisonResult.Same:
					messages.Add(ExportMessage.Info(fileName, "WatchTable", "Watch table '" + tableName + "' is identical - skipped"));
					return new
					{
						success = true,
						skipped = true,
						filePath = xmlFilePath,
						messages = messages
					};
				case BlockComparisonResult.Different:
					break;
				default:
					messages.Add(ExportMessage.Warning(fileName, "WatchTable", "Watch table '" + tableName + "' exists but comparison failed - skipping"));
					return new
					{
						success = true,
						skipped = true,
						filePath = xmlFilePath,
						messages = messages
					};
				}
				try
				{
					val.Delete();
					messages.Add(ExportMessage.Info(fileName, "WatchTable", "Watch table '" + tableName + "' differs - deleted and will be reimported"));
					val = null;
				}
				catch (EngineeringException ex)
				{
					EngineeringException ex2 = ex;
					messages.Add(ExportMessage.Warning(fileName, "WatchTable", "Could not delete existing watch table '" + tableName + "': " + ((Exception)(object)ex2).Message + ". Trying import with Override..."));
				}
			}
			else if (options.OverwriteExisting && !options.CompareBeforeImport && val != null)
			{
				try
				{
					val.Delete();
					messages.Add(ExportMessage.Info(fileName, "WatchTable", "Deleted existing watch table '" + tableName + "' before export"));
					val = null;
				}
				catch (EngineeringException ex3)
				{
					EngineeringException ex4 = ex3;
					messages.Add(ExportMessage.Warning(fileName, "WatchTable", "Could not delete watch table '" + tableName + "': " + ((Exception)(object)ex4).Message + ". Trying import with Override..."));
				}
			}
			ImportOptions val2 = (ImportOptions)(options.OverwriteExisting ? 1 : 0);
			((PlcWatchAndForceTableGroup)watchAndForceTableGroup).WatchTables.Import(fileInfo, val2);
			messages.Add(ExportMessage.Success(fileName, "WatchTable", "Exported successfully to " + plcSoftware.Name));
			return new
			{
				success = true,
				filePath = xmlFilePath,
				messages = messages
			};
		}
		catch (EngineeringException ex5)
		{
			string text = ErrorHelper.ExtractFullErrorMessage((Exception)ex5);
			messages.Add(ExportMessage.Error(fileName, "WatchTable", "Failed to export watch table to TIA Portal", text, xmlFilePath));
			return new
			{
				success = false,
				error = text,
				filePath = xmlFilePath,
				messages = messages
			};
		}
		catch (Exception ex6)
		{
			string text2 = ErrorHelper.ExtractFullErrorMessage(ex6);
			messages.Add(ExportMessage.Error(fileName, "WatchTable", "Failed to export watch table to TIA Portal", text2, xmlFilePath));
			return new
			{
				success = false,
				error = text2,
				filePath = xmlFilePath,
				messages = messages
			};
		}
	}
}
